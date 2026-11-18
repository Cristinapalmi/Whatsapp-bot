import type { Category, PrismaClient } from "@prisma/client";
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

export async function createSeriesDraft(
  db: PrismaClient,
  artistId: string,
  data: { title: string; synopsis: string; category: Category; plannedEpisodes: number; coverKey?: string | null },
) {
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
      plannedEpisodes: data.plannedEpisodes,
      coverKey: data.coverKey ?? null,
      status: "DRAFT",
    },
  });
}

export async function updateSeriesDetails(
  db: PrismaClient,
  artistId: string,
  seriesId: string,
  data: { title: string; synopsis: string; category: Category; plannedEpisodes: number; coverKey?: string | null },
) {
  const s = await getOwnedSeries(db, artistId, seriesId);
  if (!isSeriesEditable(s.status)) throw new UserFacingError("Esta série já foi enviada ou publicada. Para mudar os dados, fala com a equipa.");
  return db.series.update({
    where: { id: s.id },
    data: {
      title: data.title,
      synopsis: data.synopsis,
      category: data.category,
      plannedEpisodes: data.plannedEpisodes,
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

/** "Enviar para revisão": a série (se for nova) e os episódios com vídeo ainda por enviar. */
export async function submitForReview(db: PrismaClient, artistId: string, seriesId: string) {
  const s = await db.series.findUnique({ where: { id: seriesId }, include: { episodes: true, artist: true } });
  if (!s || s.artistId !== artistId) throw new UserFacingError("Série não encontrada.");
  if (s.status === "HIDDEN") throw new UserFacingError("Esta série foi retirada.");
  const ready = s.episodes.filter((e) => isEpisodeEditable(e.status) && e.videoKey);
  const newSeries = isSeriesEditable(s.status);
  if (newSeries && !s.coverKey) throw new UserFacingError("Carrega a capa antes de enviar.");
  if (newSeries && !s.episodes.some((e) => e.videoKey)) throw new UserFacingError("Carrega o vídeo de pelo menos um episódio antes de enviar.");
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
