import type { PrismaClient } from "@prisma/client";

/** Séries publicadas ordenadas por "em alta" (tempo visto nos últimos 7 dias, depois visualizações). Dados reais. */
export async function hotSeries(db: PrismaClient, limit = 10) {
  const series = await db.series.findMany({
    where: { status: "PUBLISHED" },
    include: { artist: { select: { stageName: true } }, episodes: { where: { published: true }, select: { id: true } } },
  });
  const epToSeries = new Map<string, string>();
  for (const s of series) for (const e of s.episodes) epToSeries.set(e.id, s.id);
  const since = new Date(Date.now() - 7 * 86400000);
  const [trending, viewsByEp] = await Promise.all([
    db.watchLog.groupBy({ by: ["episodeId"], where: { day: { gte: since } }, _sum: { seconds: true } }),
    db.watchProgress.groupBy({ by: ["episodeId"], _count: { _all: true } }),
  ]);
  const hot = new Map<string, number>();
  for (const t of trending) { const sid = epToSeries.get(t.episodeId); if (sid) hot.set(sid, (hot.get(sid) ?? 0) + (t._sum.seconds ?? 0)); }
  const views = new Map<string, number>();
  for (const v of viewsByEp) { const sid = epToSeries.get(v.episodeId); if (sid) views.set(sid, (views.get(sid) ?? 0) + v._count._all); }
  return series
    .map((s) => ({ ...s, views: views.get(s.id) ?? 0, hot: hot.get(s.id) ?? 0 }))
    .sort((a, b) => b.hot - a.hot || b.views - a.views || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, limit);
}

/** Episódios publicados mais recentes. */
export function recentEpisodes(db: PrismaClient, limit = 10) {
  return db.episode.findMany({
    where: { published: true, videoKey: { not: null }, series: { status: "PUBLISHED" } },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
    include: { series: { select: { slug: true, title: true, coverKey: true, freeEpisodes: true, artist: { select: { stageName: true } } } } },
  });
}

/** Criadores com séries publicadas (mais seguidos primeiro). */
export async function featuredCreators(db: PrismaClient, limit = 12) {
  const artists = await db.artistProfile.findMany({
    where: { status: "APPROVED", series: { some: { status: "PUBLISHED" } } },
    select: {
      id: true, slug: true, stageName: true, photoKey: true, founderNumber: true, verifiedAt: true,
      _count: { select: { followers: true, series: { where: { status: "PUBLISHED" } } } },
    },
  });
  return artists.sort((a, b) => b._count.followers - a._count.followers || b._count.series - a._count.series).slice(0, limit);
}
