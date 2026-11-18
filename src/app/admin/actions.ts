"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { kzToCents } from "@/lib/money";
import { toActionError } from "@/lib/actions";
import { confirmPayment, rejectPayment, reversePayment } from "@/domain/payments/service";
import { markPayoutPaid, rejectPayout } from "@/domain/payouts/service";
import { closeEndedWeeks } from "@/domain/payments/pass";
import { setSetting } from "@/domain/coins/service";
import { distributeAdPool, registerAdRevenue } from "@/domain/ads/service";
import { runDemoCleanup } from "@/domain/demo-cleanup";
import { approveReview, rejectReview } from "@/domain/series-workflow";
import { audit, notify } from "@/domain/notify";
import { saveIntGroup } from "@/domain/settings";
import { blockFromPoints, voidInvite } from "@/domain/fans/invites";
import { deleteObject, getUploadUrl, inspectObject, newKey, putObject } from "@/domain/storage";
import { MAX_VIDEO_BYTES, readValidatedFile, sniff } from "@/lib/filetype";
import { UserFacingError } from "@/domain/errors";
import type { ActionResult } from "@/components/ActionForm";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ---------- Pagamentos ----------
export async function confirmPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await confirmPayment(db, { paymentId: str(fd, "id"), adminId: admin.id });
  } catch (e) { return toActionError(e); }
  redirect("/admin/pagamentos?feito=confirmado");
}
export async function rejectPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let blocked = false;
  try {
    const admin = await requireAdmin();
    const reason = str(fd, "reason");
    const p = await rejectPayment(db, { paymentId: str(fd, "id"), adminId: admin.id, reason });
    // "Rejeitar e bloquear": lista negra — a pessoa deixa de poder enviar comprovativos
    if (fd.get("block") === "1") {
      await db.user.update({ where: { id: p.userId }, data: { paymentsBlockedAt: new Date(), paymentsBlockedReason: reason.slice(0, 300) } });
      await audit(db, admin.id, "PAYMENTS_BLOCKED", "User", p.userId, { paymentId: p.id, reason });
      blocked = true;
    }
  } catch (e) { return toActionError(e); }
  redirect(`/admin/pagamentos?feito=${blocked ? "bloqueado" : "rejeitado"}`);
}
export async function reversePaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await reversePayment(db, { paymentId: str(fd, "id"), adminId: admin.id, reason: str(fd, "reason") });
  } catch (e) { return toActionError(e); }
  redirect("/admin/pagamentos?estado=REVERSED&feito=anulado");
}

// ---------- Levantamentos ----------
export async function markPayoutPaidAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const payout = await db.payoutRequest.findUnique({ where: { id: str(fd, "id") }, include: { artist: true } });
    if (payout && !payout.artist.verifiedAt) return { error: "Primeiro verifica o BI e o IBAN deste artista (botão acima)." };
    let proofKey: string | undefined;
    const file = fd.get("proof");
    if (file instanceof File && file.size > 0) {
      const f = await readValidatedFile(file, ["jpeg", "png", "webp", "pdf"], 5 * 1024 * 1024, "Comprovativo").catch((e: Error) => ({ error: e.message }));
      if ("error" in f) return { error: f.error };
      proofKey = newKey("payouts", f.type === "jpeg" ? "jpg" : f.type!);
      await putObject("private", proofKey, f.bytes, f.type === "pdf" ? "application/pdf" : `image/${f.type}`);
    }
    await markPayoutPaid(db, { payoutId: str(fd, "id"), adminId: admin.id, proofKey, note: str(fd, "note") || undefined });
  } catch (e) { return toActionError(e); }
  redirect("/admin/levantamentos?feito=pago");
}
export async function rejectPayoutAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await rejectPayout(db, { payoutId: str(fd, "id"), adminId: admin.id, reason: str(fd, "reason") });
  } catch (e) { return toActionError(e); }
  redirect("/admin/levantamentos?feito=rejeitado");
}

// ---------- Artistas ----------
export async function reviewArtistAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = str(fd, "id");
    const decision = str(fd, "decision") as "APPROVED" | "REJECTED" | "SUSPENDED";
    if (!["APPROVED", "REJECTED", "SUSPENDED"].includes(decision)) return { error: "Decisão inválida." };
    const reason = str(fd, "reason");
    if (decision !== "APPROVED" && reason.length < 3) return { error: "Indica o motivo." };
    const artist = await db.artistProfile.update({
      where: { id },
      data: {
        status: decision,
        rejectionReason: decision === "APPROVED" ? null : reason,
        ...(decision === "APPROVED" ? { approvedAt: new Date(), approvedById: admin.id } : {}),
      },
    });
    const msg = {
      APPROVED: ["Conta de artista aprovada", "Já podes enviar séries e acompanhar a tua carteira."],
      REJECTED: ["Registo de artista não aprovado", `Motivo: ${reason}`],
      SUSPENDED: ["Conta de artista suspensa", `Motivo: ${reason}`],
    }[decision];
    await notify(db, artist.userId, msg[0], msg[1], "/artista");
    await audit(db, admin.id, `ARTIST_${decision}`, "ArtistProfile", id, { reason });
    revalidatePath("/admin/artistas");
    return { ok: "Guardado." };
  } catch (e) { return toActionError(e); }
}

// ---------- Séries ----------
export async function setSeriesStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = str(fd, "id");
    const status = str(fd, "status") as "APPROVED" | "PUBLISHED" | "REJECTED" | "HIDDEN";
    if (!["APPROVED", "PUBLISHED", "REJECTED", "HIDDEN"].includes(status)) return { error: "Estado inválido." };
    const reason = str(fd, "reason");
    const series = await db.series.findUniqueOrThrow({ where: { id }, include: { artist: true, episodes: true } });
    if (status === "PUBLISHED") {
      const published = series.episodes.filter((e) => e.published && e.videoKey);
      if (published.length === 0) throw new UserFacingError("Publica pelo menos um episódio com vídeo antes de publicar a série.");
      if (!series.coverKey) throw new UserFacingError("Carrega a capa antes de publicar.");
    }
    if ((status === "REJECTED" || status === "HIDDEN") && reason.length < 3) return { error: "Indica o motivo." };
    await db.series.update({
      where: { id },
      data: { status, rejectionReason: reason || null, ...(status === "PUBLISHED" && !series.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    const msg: Record<string, string> = {
      APPROVED: `A tua série "${series.title}" foi aprovada. Vamos preparar os episódios.`,
      PUBLISHED: `A tua série "${series.title}" já está publicada!`,
      REJECTED: `A tua série "${series.title}" não foi aprovada. Motivo: ${reason}`,
      HIDDEN: `A tua série "${series.title}" foi retirada. Motivo: ${reason}`,
    };
    await notify(db, series.artist.userId, "Atualização da série", msg[status], "/artista");
    await audit(db, admin.id, `SERIES_${status}`, "Series", id, { reason });
    revalidatePath(`/admin/series/${id}`);
    return { ok: "Estado atualizado." };
  } catch (e) { return toActionError(e); }
}

export async function createVideoUploadAction(targetId: string, quality: "low" | "medium" | "trailer" | "ad", contentType: string) {
  await requireAdmin();
  if (!["video/mp4", "video/webm"].includes(contentType)) throw new Error("O vídeo tem de ser MP4.");
  const ext = contentType === "video/webm" ? "webm" : "mp4";
  if (quality === "ad") {
    const ad = await db.ad.findUniqueOrThrow({ where: { id: targetId } });
    const key = newKey(`ads/${ad.id}`, ext);
    return { key, url: await getUploadUrl("media", key, contentType) };
  }
  if (quality === "trailer") {
    const series = await db.series.findUniqueOrThrow({ where: { id: targetId } });
    const key = newKey(`trailers/${series.id}`, ext);
    return { key, url: await getUploadUrl("media", key, contentType) };
  }
  const ep = await db.episode.findUniqueOrThrow({ where: { id: targetId } });
  const key = newKey(`videos/${ep.seriesId}`, ext);
  return { key, url: await getUploadUrl("media", key, contentType) };
}

export async function attachVideoAction(episodeId: string, quality: "low" | "medium" | "trailer" | "ad", key: string, durationSec: number) {
  const admin = await requireAdmin();
  // Confirmar no servidor que o ficheiro enviado é mesmo um vídeo e não passa do limite
  const info = await inspectObject("media", key);
  const realType = info ? sniff(info.head) : null;
  if (!info || (realType !== "mp4" && realType !== "webm") || info.size > MAX_VIDEO_BYTES) {
    await deleteObject("media", key).catch(() => {});
    throw new Error("O ficheiro não é um vídeo MP4 válido (ou passa de 50 MB).");
  }
  if (quality === "ad") {
    // Aqui "episodeId" é o id do anúncio
    if (!key.startsWith("ads/")) throw new Error("Chave inválida");
    if (!(durationSec > 0)) throw new Error("Não consegui ler a duração do vídeo. Usa um MP4 normal.");
    await db.ad.update({ where: { id: episodeId }, data: { videoKey: key, durationSec: Math.ceil(durationSec) } });
    await audit(db, admin.id, "AD_VIDEO_UPLOADED", "Ad", episodeId, { key, durationSec });
    revalidatePath("/admin/anuncios");
    return;
  }
  if (quality === "trailer") {
    // Aqui "episodeId" é o id da série
    if (!key.startsWith("trailers/")) throw new Error("Chave inválida");
    const series = await db.series.update({ where: { id: episodeId }, data: { trailerKey: key, trailerUpdatedAt: new Date() } , include: { artist: true } });
    await notify(db, series.artist.userId, "O teu trailer está pronto", `Descarrega o trailer de "${series.title}" e publica no TikTok e no Instagram.`, "/artista");
    await audit(db, admin.id, "TRAILER_UPLOADED", "Series", series.id, { key });
    revalidatePath(`/admin/series/${series.id}`);
    return;
  }
  if (!key.startsWith("videos/")) throw new Error("Chave inválida");
  const ep = await db.episode.update({
    where: { id: episodeId },
    data: quality === "medium" ? { videoKeyHd: key } : { videoKey: key, ...(durationSec > 0 ? { durationSec: Math.round(durationSec) } : {}) },
  });
  await audit(db, admin.id, "VIDEO_UPLOADED", "Episode", episodeId, { quality, key });
  revalidatePath(`/admin/series/${ep.seriesId}`);
}

// ---------- Denúncias ----------
export async function resolveReportAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = str(fd, "id");
    const status = str(fd, "status") === "RESOLVED" ? "RESOLVED" : "DISMISSED";
    await db.report.update({ where: { id }, data: { status, resolvedAt: new Date() } });
    await audit(db, admin.id, `REPORT_${status}`, "Report", id);
    revalidatePath("/admin/denuncias");
    return { ok: "Atualizado." };
  } catch (e) { return toActionError(e); }
}

// ---------- Passe semanal ----------
export async function closeWeeksAction(_: ActionResult, _fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const results = await closeEndedWeeks(db, { adminId: admin.id });
    revalidatePath("/admin/passe");
    return { ok: results.length ? `Semanas fechadas: ${results.map((r) => r.week).join(", ")}.` : "Não há semanas terminadas por fechar." };
  } catch (e) { return toActionError(e); }
}

// ---------- Moedas: pacotes, preço por defeito, presentes ----------
const packSchema = z.object({
  id: z.string().optional(),
  priceKz: z.coerce.number().int().min(100, "Preço mínimo 100 Kz").max(1000000),
  coins: z.coerce.number().int().min(1, "Mínimo 1 moeda").max(1000000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.literal("on").optional(),
});

export async function saveCoinPackAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const d = packSchema.parse(Object.fromEntries(fd));
    const data = { priceKz: d.priceKz, coins: d.coins, sortOrder: d.sortOrder, active: !!d.active };
    const pack = d.id ? await db.coinPack.update({ where: { id: d.id }, data }) : await db.coinPack.create({ data: { ...data, active: true } });
    await audit(db, admin.id, d.id ? "COIN_PACK_UPDATED" : "COIN_PACK_CREATED", "CoinPack", pack.id, data);
    revalidatePath("/admin/moedas");
    return { ok: "Pacote guardado." };
  } catch (e) { return toActionError(e); }
}

/** Grava um grupo de regras numéricas (preços, ofertas, fundadores, convites…). */
export async function saveSettingsGroupAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const group = str(fd, "group");
    let changed: Record<string, number>;
    try {
      changed = await saveIntGroup(db, group, Object.fromEntries(fd));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Valor inválido." };
    }
    await audit(db, admin.id, "SETTINGS_SAVED", "Setting", group, changed);
    revalidatePath("/admin", "layout");
    return { ok: "Guardado." };
  } catch (e) { return toActionError(e); }
}

const giftSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, "Código: letras maiúsculas, números ou _ (2 a 20)."),
  isNew: z.string().optional(),
  label: z.string().trim().min(2, "Indica o nome.").max(30),
  emoji: z.string().trim().min(1, "Indica um emoji.").max(8),
  priceCoins: z.coerce.number().int().min(1, "Mínimo 1 moeda").max(100000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.literal("on").optional(),
});

export async function saveGiftTypeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const d = giftSchema.parse(Object.fromEntries(fd));
    const data = { label: d.label, emoji: d.emoji, priceCoins: d.priceCoins, sortOrder: d.sortOrder, active: d.isNew ? true : !!d.active };
    if (d.isNew && (await db.giftType.findUnique({ where: { code: d.code } }))) return { error: "Já existe um presente com esse código." };
    await db.giftType.upsert({ where: { code: d.code }, create: { code: d.code, ...data }, update: data });
    await audit(db, admin.id, "GIFT_TYPE_SAVED", "GiftType", d.code, data);
    revalidatePath("/admin/moedas");
    return { ok: "Presente guardado." };
  } catch (e) { return toActionError(e); }
}

// ---------- Destaque e Premium (o admin não edita a série; só decide onde aparece) ----------
export async function setFeaturedAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = str(fd, "id");
    const on = str(fd, "on") === "1";
    const s = await db.series.findUniqueOrThrow({ where: { id } });
    if (on && s.status !== "PUBLISHED") return { error: "Só uma série publicada pode ficar em destaque." };
    await db.$transaction([
      ...(on ? [db.series.updateMany({ where: { featured: true, NOT: { id } }, data: { featured: false } })] : []),
      db.series.update({ where: { id }, data: { featured: on } }),
    ]);
    await audit(db, admin.id, on ? "SERIES_FEATURED" : "SERIES_UNFEATURED", "Series", id, {});
    revalidatePath(`/admin/series/${id}`);
    revalidatePath("/");
    return { ok: on ? "Em destaque na página inicial." : "Já não está em destaque." };
  } catch (e) { return toActionError(e); }
}

export async function setPremiumAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = str(fd, "id");
    const on = str(fd, "on") === "1";
    const s = await db.series.findUniqueOrThrow({ where: { id }, include: { artist: true } });
    await db.series.update({ where: { id }, data: { tier: on ? "PREMIUM" : "NORMAL" } });
    if (on && s.tier !== "PREMIUM") {
      await notify(db, s.artist.userId, "Série Premium 💎", `A tua série "${s.title}" passou a Premium 💎! Agora ganhas mais por episódio.`, `/artista/series/${id}`);
    }
    await audit(db, admin.id, on ? "SERIES_PREMIUM_ON" : "SERIES_PREMIUM_OFF", "Series", id, { from: s.tier });
    revalidatePath(`/admin/series/${id}`);
    return { ok: on ? "Série marcada como Premium." : "Série voltou ao nível Normal." };
  } catch (e) { return toActionError(e); }
}

// ---------- Sugestão ao abrir a app ----------
export async function setSuggestedSeriesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = str(fd, "id");
    if (id) {
      const s = await db.series.findUnique({ where: { id } });
      if (!s || s.status !== "PUBLISHED") return { error: "Só podes sugerir uma série publicada." };
      await setSetting(db, "suggestedSeriesId", id);
    } else {
      await db.setting.deleteMany({ where: { key: "suggestedSeriesId" } });
    }
    await audit(db, admin.id, "SUGGESTED_SERIES_SET", "Setting", "suggestedSeriesId", { id: id || null });
    revalidatePath("/admin/series");
    return { ok: id ? "Esta série passa a ser sugerida ao abrir a app." : "Sugestão automática (série em destaque ou a mais vista)." };
  } catch (e) { return toActionError(e); }
}

// ---------- Anúncios ----------
const adSchema = z.object({
  id: z.string().optional(),
  sponsor: z.string().trim().min(2, "Indica o patrocinador.").max(60),
  title: z.string().trim().max(80).optional(),
  linkUrl: z.union([z.literal(""), z.string().trim().url("Link inválido (começa por https://).").refine((v) => v.startsWith("https://"), "O link tem de começar por https://")]).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  active: z.literal("on").optional(),
});
const day = (v?: string, end = false) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${end ? "23:59:59" : "00:00:00"}+01:00`) : null);

export async function saveAdAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const d = adSchema.parse(Object.fromEntries(fd));
    const data = {
      sponsor: d.sponsor,
      title: d.title || null,
      linkUrl: d.linkUrl || null,
      startsAt: day(d.startsAt),
      endsAt: day(d.endsAt, true),
      active: d.id ? !!d.active : true,
    };
    const ad = d.id ? await db.ad.update({ where: { id: d.id }, data }) : await db.ad.create({ data });
    await audit(db, admin.id, d.id ? "AD_UPDATED" : "AD_CREATED", "Ad", ad.id, { sponsor: d.sponsor });
    revalidatePath("/admin/anuncios");
    return { ok: d.id ? "Anúncio guardado." : "Anúncio criado. Agora carrega o vídeo." };
  } catch (e) { return toActionError(e); }
}

export async function saveAdOfferLimitAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const n = z.coerce.number().int().min(0, "Mínimo 0").max(50).parse(fd.get("adOfferLimit"));
    await setSetting(db, "adOfferLimit", String(n));
    await audit(db, admin.id, "AD_OFFER_LIMIT_UPDATED", "Setting", "adOfferLimit", { n });
    revalidatePath("/admin/anuncios");
    return { ok: n === 0 ? "Oferta com anúncio desligada." : `Cada conta pode usar a oferta ${n} ${n === 1 ? "vez" : "vezes"} no total.` };
  } catch (e) { return toActionError(e); }
}

export async function registerAdRevenueAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const d = z
      .object({
        month: z.string().regex(/^\d{4}-\d{2}$/, "Escolhe o mês."),
        amountKz: z.coerce.number().positive("Indica o valor.").max(100000000),
        sponsor: z.string().trim().max(60).optional(),
        description: z.string().trim().max(200).optional(),
      })
      .parse(Object.fromEntries(fd));
    await registerAdRevenue(db, { month: d.month, amountCents: kzToCents(d.amountKz), sponsor: d.sponsor, description: d.description, adminId: admin.id });
    revalidatePath("/admin/anuncios");
    return { ok: `Receita registada em ${d.month}.` };
  } catch (e) { return toActionError(e); }
}

export async function distributeAdPoolAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const r = await distributeAdPool(db, { month: str(fd, "month"), adminId: admin.id });
    revalidatePath("/admin/anuncios");
    return { ok: r.rolloverCents ? `Sem episódios vistos com anúncio em ${r.month}: o fundo passou para o mês seguinte.` : `Fundo de ${r.month} dividido por ${Object.keys(r.allocations).length} artista(s).` };
  } catch (e) { return toActionError(e); }
}

// ---------- Limpeza do demo ----------
export async function forceDemoCleanupAction(_: ActionResult, _fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const r = await runDemoCleanup(db, { force: true, adminId: admin.id });
    await audit(db, admin.id, "DEMO_CLEANUP", "Setting", "demoCleanup", { status: r.status });
    revalidatePath("/admin");
    if (r.status === "done") return { ok: "Séries de exemplo apagadas. As moedas e os pontos gastos nelas foram devolvidos aos fãs." };
    if (r.status === "blocked") return { error: "Ainda há pagamentos ou levantamentos ligados ao demo que precisam de decisão manual. Fala com o suporte técnico." };
    return { ok: "Não havia nada para apagar." };
  } catch (e) { return toActionError(e); }
}

// ---------- Revisão de séries ----------
export async function approveReviewAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  try {
    const admin = await requireAdmin();
    await approveReview(db, admin.id, id);
    revalidatePath("/admin/revisao");
  } catch (e) { return toActionError(e); }
  redirect("/admin/revisao?feito=aprovado");
}

export async function rejectReviewAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  try {
    const admin = await requireAdmin();
    await rejectReview(db, admin.id, id, str(fd, "reason"));
    revalidatePath("/admin/revisao");
  } catch (e) { return toActionError(e); }
  redirect("/admin/revisao?feito=recusado");
}

// ---------- Verificação do artista (antes do primeiro levantamento) ----------
export async function verifyArtistAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = str(fd, "artistId");
    if (fd.get("confirm") !== "on") return { error: "Confirma que viste o BI e que o IBAN/número está em nome do artista." };
    await db.artistProfile.update({ where: { id }, data: { verifiedAt: new Date(), verifiedById: admin.id } });
    await audit(db, admin.id, "ARTIST_VERIFIED", "ArtistProfile", id);
    revalidatePath("/admin/levantamentos");
    revalidatePath("/admin/artistas");
    return { ok: "Artista verificado. Já podes marcar o levantamento como pago." };
  } catch (e) { return toActionError(e); }
}

// ---------- Convites de fãs ----------
export async function voidInviteAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await voidInvite(db, admin.id, str(fd, "id"));
    revalidatePath("/admin/convites");
    return { ok: "Pontos do convite anulados." };
  } catch (e) { return toActionError(e); }
}

export async function blockFromPointsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await blockFromPoints(db, admin.id, str(fd, "userId"));
    revalidatePath("/admin/convites");
    return { ok: "Bloqueado: já não ganha pontos de convites nem de presença." };
  } catch (e) { return toActionError(e); }
}

export async function unblockPaymentsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const userId = str(fd, "userId");
    await db.user.update({ where: { id: userId }, data: { paymentsBlockedAt: null, paymentsBlockedReason: null } });
    await audit(db, admin.id, "PAYMENTS_UNBLOCKED", "User", userId, {});
    revalidatePath("/admin/pagamentos");
    return { ok: "Desbloqueado: já pode voltar a enviar comprovativos." };
  } catch (e) { return toActionError(e); }
}
