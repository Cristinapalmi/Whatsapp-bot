import type { Tx } from "./money/ledger";

/**
 * SUGESTÃO AO ABRIR A APP: uma série, no máximo 1 vez por dia por pessoa.
 * Escolha: a série definida no admin → a série em destaque → a mais vista → a mais recente.
 */
export const SUGGESTED_SERIES_KEY = "suggestedSeriesId";

/** Dia de hoje em Luanda (UTC+1), ex.: "2026-11-18". */
export const todayLuanda = (now = new Date()) => new Date(now.getTime() + 3600_000).toISOString().slice(0, 10);

export async function resolveSuggestedSeries(db: Tx) {
  const include = { episodes: { where: { published: true }, orderBy: { number: "asc" as const }, take: 1, select: { id: true } } };
  const chosen = await db.setting.findUnique({ where: { key: SUGGESTED_SERIES_KEY } });
  if (chosen?.value) {
    const s = await db.series.findFirst({ where: { id: chosen.value, status: "PUBLISHED" }, include });
    if (s?.episodes.length) return s;
  }
  const featured = await db.series.findFirst({ where: { status: "PUBLISHED", featured: true }, include });
  if (featured?.episodes.length) return featured;

  const views = await db.watchProgress.groupBy({ by: ["episodeId"], _count: { _all: true } });
  if (views.length) {
    const eps = await db.episode.findMany({ where: { id: { in: views.map((v) => v.episodeId) } }, select: { id: true, seriesId: true } });
    const bySeries = new Map<string, number>();
    const epSeries = new Map(eps.map((e) => [e.id, e.seriesId]));
    for (const v of views) {
      const sid = epSeries.get(v.episodeId);
      if (sid) bySeries.set(sid, (bySeries.get(sid) ?? 0) + v._count._all);
    }
    for (const [sid] of [...bySeries.entries()].sort((a, b) => b[1] - a[1])) {
      const s = await db.series.findFirst({ where: { id: sid, status: "PUBLISHED" }, include });
      if (s?.episodes.length) return s;
    }
  }
  const latest = await db.series.findFirst({ where: { status: "PUBLISHED", episodes: { some: { published: true } } }, orderBy: { publishedAt: "desc" }, include });
  return latest ?? null;
}
