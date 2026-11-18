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
import { audit, notify } from "@/domain/notify";
import { getUploadUrl, newKey, putObject } from "@/domain/storage";
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
  try {
    const admin = await requireAdmin();
    await rejectPayment(db, { paymentId: str(fd, "id"), adminId: admin.id, reason: str(fd, "reason") });
  } catch (e) { return toActionError(e); }
  redirect("/admin/pagamentos?feito=rejeitado");
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
    let proofKey: string | undefined;
    const file = fd.get("proof");
    if (file instanceof File && file.size > 0) {
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.type];
      if (!ext) return { error: "Comprovativo tem de ser imagem ou PDF." };
      if (file.size > 5 * 1024 * 1024) return { error: "Máximo 5 MB." };
      proofKey = newKey("payouts", ext);
      await putObject("private", proofKey, Buffer.from(await file.arrayBuffer()), file.type);
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
const seriesSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(2).max(80),
  synopsis: z.string().trim().max(1000),
  category: z.enum(["TERROR", "COMEDIA", "DRAMA", "MAKAS_FAMILIA", "ROMANCE", "ACAO", "OUTRO"]),
  /** Preço em moedas só para esta série (vazio = preço por defeito). */
  priceCoins: z.union([z.literal(""), z.coerce.number().int().min(1, "Preço mínimo 1 moeda").max(10000, "Preço demasiado alto")]).optional(),
  freeEpisodes: z.coerce.number().int().min(0).max(50),
  plannedEpisodes: z.coerce.number().int().min(1).max(200),
  featured: z.literal("on").optional(),
});

export async function saveSeriesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const d = seriesSchema.parse(Object.fromEntries(fd));
    let coverKey: string | undefined;
    const cover = fd.get("cover");
    if (cover instanceof File && cover.size > 0) {
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[cover.type];
      if (!ext) return { error: "Capa tem de ser JPG, PNG ou WEBP." };
      if (cover.size > 2 * 1024 * 1024) return { error: "Capa: máximo 2 MB (usa uma imagem 600×900)." };
      coverKey = newKey("covers", ext);
      await putObject("media", coverKey, Buffer.from(await cover.arrayBuffer()), cover.type);
    }
    if (d.featured) await db.series.updateMany({ where: { featured: true, NOT: { id: d.id } }, data: { featured: false } });
    await db.series.update({
      where: { id: d.id },
      data: {
        title: d.title, synopsis: d.synopsis, category: d.category, priceCoins: d.priceCoins === "" || d.priceCoins === undefined ? null : d.priceCoins,
        freeEpisodes: d.freeEpisodes, plannedEpisodes: d.plannedEpisodes, featured: !!d.featured,
        ...(coverKey ? { coverKey } : {}),
      },
    });
    await audit(db, admin.id, "SERIES_UPDATED", "Series", d.id, { priceCoins: d.priceCoins ?? null, freeEpisodes: d.freeEpisodes });
    revalidatePath(`/admin/series/${d.id}`);
    return { ok: "Série guardada." };
  } catch (e) { return toActionError(e); }
}

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

const episodeSchema = z.object({
  seriesId: z.string(),
  id: z.string().optional(),
  number: z.coerce.number().int().min(1).max(500),
  title: z.string().trim().min(1).max(100),
  synopsis: z.string().trim().max(500).optional(),
  durationSec: z.coerce.number().int().min(0).max(3600),
  endsWithHook: z.literal("on").optional(),
  hookText: z.string().trim().max(200).optional(),
  published: z.literal("on").optional(),
});

export async function saveEpisodeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const d = episodeSchema.parse(Object.fromEntries(fd));
    const values = {
      number: d.number, title: d.title, synopsis: d.synopsis || null, durationSec: d.durationSec,
      endsWithHook: !!d.endsWithHook, hookText: d.hookText || null, published: !!d.published,
    };
    let subtitlesKey: string | undefined;
    const subs = fd.get("subtitles");
    if (subs instanceof File && subs.size > 0) {
      if (!subs.name.toLowerCase().endsWith(".vtt")) return { error: "Legendas têm de estar em formato .vtt" };
      subtitlesKey = newKey("subtitles", "vtt");
      await putObject("media", subtitlesKey, Buffer.from(await subs.arrayBuffer()), "text/vtt");
    }
    if (d.id) {
      const ep = await db.episode.findUniqueOrThrow({ where: { id: d.id } });
      if (values.published && !ep.videoKey) return { error: "Carrega o vídeo antes de publicar o episódio." };
      await db.episode.update({ where: { id: d.id }, data: { ...values, ...(subtitlesKey ? { subtitlesKey } : {}) } });
    } else {
      if (await db.episode.findUnique({ where: { seriesId_number: { seriesId: d.seriesId, number: d.number } } }))
        return { error: `Já existe o episódio ${d.number}.` };
      await db.episode.create({ data: { seriesId: d.seriesId, ...values, published: false, ...(subtitlesKey ? { subtitlesKey } : {}) } });
    }
    await audit(db, admin.id, "EPISODE_SAVED", "Series", d.seriesId, { number: d.number });
    revalidatePath(`/admin/series/${d.seriesId}`);
    return { ok: "Episódio guardado." };
  } catch (e) { return toActionError(e); }
}

/** Gera um link para o navegador enviar o vídeo diretamente para o armazenamento. */
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

export async function saveEpisodePriceAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const price = z.coerce.number().int().min(1, "Mínimo 1 moeda").max(10000).parse(fd.get("episodePriceCoins"));
    await setSetting(db, "episodePriceCoins", String(price));
    await audit(db, admin.id, "EPISODE_PRICE_UPDATED", "Setting", "episodePriceCoins", { price });
    revalidatePath("/admin/moedas");
    return { ok: `Preço por defeito: ${price} moedas por episódio.` };
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
