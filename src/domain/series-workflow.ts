import type { AgeRating, Category, Episode, PrismaClient, Series } from "@prisma/client";
import { UserFacingError } from "./errors";
import { audit, notify } from "./notify";
import { slugify } from "@/lib/slug";

/**
 * O ARTISTA FAZ TUDO, A ADMIN SÓ VERIFICA E PUBLICA.
 *
 * Série:    Rascunho (DRAFT) → Enviada para revisão (IN_REVIEW) → Publicada (PUBLISHED) / Recusada (REJECTED)
 * Episódio: Rascunho → Em revisão → Publicado / Recusado. Episódios novos numa série publicada
 *           também passam por revisão antes de aparecer.
 * O artista NÃO controla o preço em moedas nem o número de episódios grátis.
 */

const EDITABLE_SERIES = ["DRAFT", "REJECTED"] as const;
const EDITABLE_EPISODE = ["DRAFT", "REJECTED"] as const;

export async function getOwnedSeries(db: PrismaClient, artistId: string, seriesId: string) {
  const s = await db.series.findUnique({ where: { id: seriesId } });
  if (!s || s.artistId !== artistId) throw new UserFacingError("Série não encontrada.");
  return s;
}

export async function getOwnedEpisode(db: PrismaClient, artistId: string, episodeId: string) {
  const e = await db.episode.findUnique({ where: { id: episodeId }, include: { series: true } });
  if (!e || e.series.artistId !== artistId) throw new UserFacingError("Episódio não encontrado.");
  return e;
}

export const isEpisodeEditable = (status: string) => (EDITABLE_EPISODE as readonly string[]).includes(status);
export const isSeriesEditable = (status: string) => (EDITABLE_SERIES as readonly string[]).includes(status);

export type SeriesDetails = {
  title: string;
  synopsis: string;
  category: Category;
  plannedEpisodes?: number;
  ageRating?: AgeRating;
  language?: string;
  tags?: string[];
  coverKey?: string | null;
};

export async function createSeriesDraft(db: PrismaClient, artistId: string, data: SeriesDetails) {
  const base = slugify(data.title) || "serie";
  let slug = base;
  for (let i = 2; await db.series.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return db.series.create({
    data: {
      artistId,
      title: data.title,
      slug,
      synopsis: data.synopsis,
      category: data.category,
      plannedEpisodes: data.plannedEpisodes ?? 10,
      ageRating: data.ageRating ?? "ALL",
      language: data.language ?? "PT",
      tags: data.tags ?? [],
      coverKey: data.coverKey ?? null,
      status: "DRAFT",
    },
  });
}

export async function updateSeriesDetails(db: PrismaClient, artistId: string, seriesId: string, data: SeriesDetails) {
  const s = await getOwnedSeries(db, artistId, seriesId);
  if (!isSeriesEditable(s.status)) throw new UserFacingError("Esta série já foi enviada ou publicada. Para mudar os dados, fala com a equipa.");
  return db.series.update({
    where: { id: s.id },
    data: {
      title: data.title,
      synopsis: data.synopsis,
      category: data.category,
      ...(data.plannedEpisodes ? { plannedEpisodes: data.plannedEpisodes } : {}),
      ...(data.ageRating ? { ageRating: data.ageRating } : {}),
      ...(data.language ? { language: data.language } : {}),
      ...(data.tags ? { tags: data.tags } : {}),
      ...(data.coverKey ? { coverKey: data.coverKey } : {}),
      ...(s.status === "REJECTED" ? { status: "DRAFT" as const } : {}),
    },
  });
}

export async function addEpisode(db: PrismaClient, artistId: string, seriesId: string, title: string) {
  const s = await getOwnedSeries(db, artistId, seriesId);
  if (s.status === "HIDDEN") throw new UserFacingError("Esta série foi retirada.");
  const last = await db.episode.findFirst({ where: { seriesId: s.id }, orderBy: { number: "desc" } });
  return db.episode.create({ data: { seriesId: s.id, number: (last?.number ?? 0) + 1, title, status: "DRAFT", published: false } });
}

export async function updateEpisode(
  db: PrismaClient,
  artistId: string,
  episodeId: string,
  data: { title: string; endsWithHook: boolean; hookText: string | null; subtitlesKey?: string },
) {
  const e = await getOwnedEpisode(db, artistId, episodeId);
  if (!isEpisodeEditable(e.status)) throw new UserFacingError("Só podes mudar episódios que ainda não foram enviados ou publicados.");
  return db.episode.update({
    where: { id: e.id },
    data: {
      title: data.title,
      endsWithHook: data.endsWithHook,
      hookText: data.endsWithHook ? data.hookText : null,
      ...(data.subtitlesKey ? { subtitlesKey: data.subtitlesKey } : {}),
      ...(e.status === "REJECTED" ? { status: "DRAFT" as const, rejectionReason: null } : {}),
    },
  });
}

/** Troca a posição de um episódio com o de cima/baixo (ambos por publicar). */
export async function moveEpisode(db: PrismaClient, artistId: string, episodeId: string, direction: "up" | "down") {
  const e = await getOwnedEpisode(db, artistId, episodeId);
  if (!isEpisodeEditable(e.status)) throw new UserFacingError("Só podes mover episódios por publicar.");
  const other = await db.episode.findFirst({
    where: { seriesId: e.seriesId, number: direction === "up" ? { lt: e.number } : { gt: e.number } },
    orderBy: { number: direction === "up" ? "desc" : "asc" },
  });
  if (!other) return e;
  if (!isEpisodeEditable(other.status)) throw new UserFacingError("Não podes trocar com um episódio já enviado ou publicado.");
  await db.$transaction([
    db.episode.update({ where: { id: e.id }, data: { number: -e.number } }),
    db.episode.update({ where: { id: other.id }, data: { number: e.number } }),
    db.episode.update({ where: { id: e.id }, data: { number: other.number } }),
  ]);
  return e;
}

/** Apaga um episódio por publicar e fecha o espaço na numeração. */
export async function deleteEpisode(db: PrismaClient, artistId: string, episodeId: string) {
  const e = await getOwnedEpisode(db, artistId, episodeId);
  if (!isEpisodeEditable(e.status)) throw new UserFacingError("Só podes apagar episódios por publicar.");
  const later = await db.episode.findMany({ where: { seriesId: e.seriesId, number: { gt: e.number } }, orderBy: { number: "asc" } });
  const canRenumber = later.every((x) => isEpisodeEditable(x.status));
  await db.$transaction(async (tx) => {
    await tx.episode.delete({ where: { id: e.id } });
    if (canRenumber) for (const x of later) await tx.episode.update({ where: { id: x.id }, data: { number: x.number - 1 } });
  });
  return { keys: [e.videoKey, e.videoKeyHd, e.subtitlesKey].filter((k): k is string => !!k && !k.startsWith("/")) };
}

export const MIN_EPISODES_TO_SUBMIT = 3;
export const HOOK_EPISODE = 3;

export type ChecklistItem = { ok: boolean; text: string };

/** Lista de verificação antes de "Enviar para revisão" (o que falta, em linguagem simples). */
export function reviewChecklist(s: Pick<Series, "status" | "coverKey" | "synopsis">, episodes: Pick<Episode, "number" | "status" | "videoKey" | "endsWithHook" | "hookText">[]): ChecklistItem[] {
  const withVideo = episodes.filter((e) => e.videoKey).length;
  const hookEp = episodes.find((e) => e.number === HOOK_EPISODE);
  const hookOk = !!hookEp && hookEp.endsWithHook && !!hookEp.hookText?.trim();
  if (!isSeriesEditable(s.status)) {
    const pending = episodes.filter((e) => isEpisodeEditable(e.status));
    const items: ChecklistItem[] = [{ ok: pending.some((e) => e.videoKey), text: "Pelo menos um episódio novo com vídeo" }];
    if (hookEp && isEpisodeEditable(hookEp.status)) items.push({ ok: hookOk, text: `Episódio ${HOOK_EPISODE} com gancho e texto do gancho` });
    return items;
  }
  return [
    { ok: !!s.coverKey, text: "Capa carregada" },
    { ok: s.synopsis.trim().length >= 20, text: "Sinopse escrita (pelo menos uma frase)" },
    { ok: withVideo >= MIN_EPISODES_TO_SUBMIT, text: `Pelo menos ${MIN_EPISODES_TO_SUBMIT} episódios com vídeo (tens ${withVideo})` },
    { ok: hookOk, text: `Episódio ${HOOK_EPISODE} marcado com gancho e com o texto do gancho` },
  ];
}

/** "Enviar para revisão": a série (se for nova) e os episódios com vídeo ainda por enviar. */
export async function submitForReview(db: PrismaClient, artistId: string, seriesId: string) {
  const s = await db.series.findUnique({ where: { id: seriesId }, include: { episodes: true, artist: true } });
  if (!s || s.artistId !== artistId) throw new UserFacingError("Série não encontrada.");
  if (s.status === "HIDDEN") throw new UserFacingError("Esta série foi retirada.");
  const ready = s.episodes.filter((e) => isEpisodeEditable(e.status) && e.videoKey);
  const newSeries = isSeriesEditable(s.status);
  const missing = reviewChecklist(s, s.episodes).filter((i) => !i.ok);
  if (missing.length) throw new UserFacingError(`Antes de enviar falta: ${missing.map((m) => m.text.toLowerCase()).join("; ")}.`);
  if (!newSeries && ready.length === 0) throw new UserFacingError("Não há episódios novos com vídeo para enviar.");
  const missingVideo = s.episodes.filter((e) => isEpisodeEditable(e.status) && !e.videoKey).length;
  const now = new Date();
  await db.$transaction([
    ...(newSeries ? [db.series.update({ where: { id: s.id }, data: { status: "IN_REVIEW", rejectionReason: null } })] : []),
    db.episode.updateMany({
      where: { id: { in: ready.map((e) => e.id) } },
      data: { status: "IN_REVIEW", submittedAt: now, rejectionReason: null },
    }),
  ]);
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins)
    await notify(db, a.id, "Série para rever", `${s.artist.stageName}: "${s.title}" (${ready.length} episódio(s)).`, `/admin/revisao/${s.id}`);
  return { episodes: ready.length, missingVideo };
}

/** Admin: aprova e publica a série e/ou os episódios em revisão. */
export async function approveReview(db: PrismaClient, adminId: string, seriesId: string) {
  const s = await db.series.findUnique({ where: { id: seriesId }, include: { episodes: true, artist: true } });
  if (!s) throw new UserFacingError("Série não encontrada.");
  const inReview = s.episodes.filter((e) => e.status === "IN_REVIEW");
  if (s.status !== "IN_REVIEW" && inReview.length === 0) throw new UserFacingError("Não há nada para rever nesta série.");
  if (s.status === "IN_REVIEW" && !s.coverKey) throw new UserFacingError("A série não tem capa.");
  const willBeVisible = s.episodes.some((e) => e.status === "PUBLISHED") || inReview.some((e) => e.videoKey);
  if (!willBeVisible) throw new UserFacingError("Nenhum episódio com vídeo para publicar.");
  await db.$transaction([
    db.episode.updateMany({ where: { id: { in: inReview.filter((e) => e.videoKey).map((e) => e.id) } }, data: { status: "PUBLISHED", published: true, rejectionReason: null } }),
    ...(s.status === "IN_REVIEW"
      ? [db.series.update({ where: { id: s.id }, data: { status: "PUBLISHED", rejectionReason: null, publishedAt: s.publishedAt ?? new Date() } })]
      : []),
  ]);
  await notify(
    db,
    s.artist.userId,
    s.status === "IN_REVIEW" ? "A tua série foi publicada!" : "Episódios publicados",
    s.status === "IN_REVIEW" ? `"${s.title}" já está no catálogo. Partilha o teu link!` : `${inReview.length} episódio(s) novo(s) de "${s.title}" já estão visíveis.`,
    `/artista/series/${s.id}`,
  );
  await audit(db, adminId, "REVIEW_APPROVED", "Series", s.id, { episodes: inReview.length, newSeries: s.status === "IN_REVIEW" });
}

/** Admin: recusa (motivo obrigatório). O artista pode corrigir e voltar a enviar. */
export async function rejectReview(db: PrismaClient, adminId: string, seriesId: string, reason: string) {
  const r = reason.trim();
  if (r.length < 5) throw new UserFacingError("Escreve o motivo (para o artista saber o que corrigir).");
  const s = await db.series.findUnique({ where: { id: seriesId }, include: { episodes: true, artist: true } });
  if (!s) throw new UserFacingError("Série não encontrada.");
  const inReview = s.episodes.filter((e) => e.status === "IN_REVIEW");
  if (s.status !== "IN_REVIEW" && inReview.length === 0) throw new UserFacingError("Não há nada para rever nesta série.");
  await db.$transaction([
    db.episode.updateMany({ where: { id: { in: inReview.map((e) => e.id) } }, data: { status: "REJECTED", rejectionReason: r } }),
    ...(s.status === "IN_REVIEW" ? [db.series.update({ where: { id: s.id }, data: { status: "REJECTED", rejectionReason: r } })] : []),
  ]);
  await notify(db, s.artist.userId, "Revisão: precisa de correções", `"${s.title}": ${r}`, `/artista/series/${s.id}`);
  await audit(db, adminId, "REVIEW_REJECTED", "Series", s.id, { reason: r });
}

export async function reviewQueue(db: PrismaClient) {
  return db.series.findMany({
    where: { OR: [{ status: "IN_REVIEW" }, { episodes: { some: { status: "IN_REVIEW" } } }] },
    include: { artist: { select: { stageName: true } }, episodes: { where: { status: "IN_REVIEW" }, select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function reviewCount(db: PrismaClient) {
  return db.series.count({ where: { OR: [{ status: "IN_REVIEW" }, { episodes: { some: { status: "IN_REVIEW" } } }] } });
}

// ---------- Apagar / retirar ----------
export const WITHDRAW_GRACE_DAYS = 30;

/** Apagar uma série em Rascunho ou Recusada (nunca publicada). Devolve as chaves dos ficheiros a apagar. */
export async function deleteSeries(db: PrismaClient, artistId: string, seriesId: string) {
  const s = await db.series.findUnique({ where: { id: seriesId }, include: { episodes: true } });
  if (!s || s.artistId !== artistId) throw new UserFacingError("Série não encontrada.");
  if (!isSeriesEditable(s.status)) throw new UserFacingError("Só podes apagar séries em rascunho ou recusadas. Uma série publicada pode ser retirada.");
  if (s.episodes.some((e) => e.status === "PUBLISHED" || e.status === "IN_REVIEW")) throw new UserFacingError("Esta série tem episódios publicados ou em revisão.");
  const keys = [s.coverKey, s.trailerKey, ...s.episodes.flatMap((e) => [e.videoKey, e.videoKeyHd, e.subtitlesKey])].filter((k): k is string => !!k && !k.startsWith("/"));
  await db.$transaction(async (tx) => {
    await tx.setting.deleteMany({ where: { key: "suggestedSeriesId", value: s.id } });
    await tx.series.delete({ where: { id: s.id } }); // episódios, favoritos, denúncias em cascata
  });
  return { keys };
}

/**
 * "Retirar da KONTA": sai logo do catálogo, pesquisa, ranking e sugestão. Quem já desbloqueou
 * episódios continua a vê-los durante 30 dias; depois os vídeos e a capa são apagados.
 * O dinheiro ganho fica no saldo e os registos financeiros nunca são apagados.
 */
export async function withdrawSeries(db: PrismaClient, artistId: string, seriesId: string, reason?: string) {
  const s = await getOwnedSeries(db, artistId, seriesId);
  if (s.status !== "PUBLISHED") throw new UserFacingError("Só podes retirar séries publicadas.");
  await db.$transaction([
    db.series.update({ where: { id: s.id }, data: { status: "HIDDEN", featured: false, withdrawnAt: new Date(), withdrawReason: reason?.trim() || null } }),
    db.setting.deleteMany({ where: { key: "suggestedSeriesId", value: s.id } }),
  ]);
  return s;
}

export const withdrawnUntil = (withdrawnAt: Date) => new Date(withdrawnAt.getTime() + WITHDRAW_GRACE_DAYS * 86400000);

/** Depois dos 30 dias: apaga os vídeos, legendas, trailer e capa das séries retiradas. */
export async function purgeWithdrawnSeries(db: PrismaClient, now = new Date(), del: (key: string) => Promise<unknown> = async () => {}) {
  const limit = new Date(now.getTime() - WITHDRAW_GRACE_DAYS * 86400000);
  const list = await db.series.findMany({ where: { withdrawnAt: { lt: limit }, purgedAt: null }, include: { episodes: true } });
  for (const s of list) {
    const keys = [s.coverKey, s.trailerKey, ...s.episodes.flatMap((e) => [e.videoKey, e.videoKeyHd, e.subtitlesKey])].filter((k): k is string => !!k && !k.startsWith("/"));
    for (const k of keys) await del(k).catch(() => {});
    await db.$transaction([
      db.episode.updateMany({ where: { seriesId: s.id }, data: { videoKey: null, videoKeyHd: null, subtitlesKey: null, published: false } }),
      db.series.update({ where: { id: s.id }, data: { coverKey: null, trailerKey: null, purgedAt: now } }),
    ]);
  }
  return list.length;
}

/**
 * Séries que ainda se podem ver: publicadas, ou retiradas pelo artista há menos de 30 dias
 * (só para quem já tinha desbloqueado — não aparecem no catálogo nem se desbloqueiam).
 */
export const watchableSeriesWhere = (now = new Date()) => ({
  OR: [
    { status: "PUBLISHED" as const },
    { status: "HIDDEN" as const, purgedAt: null, withdrawnAt: { gte: new Date(now.getTime() - WITHDRAW_GRACE_DAYS * 86400000) } },
  ],
});
