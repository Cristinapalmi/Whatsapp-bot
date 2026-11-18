import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { EARNING_KINDS } from "./money/accounts";

/**
 * RANKING DOS CRIADORES — por FÃS, DESBLOQUEIOS e SEGUIDORES (nunca por dinheiro).
 *  - Fãs: pessoas diferentes que viram episódios do criador no período.
 *  - Desbloqueios: episódios desbloqueados com moedas no período.
 *  - Seguidores: novos seguidores no período.
 * O valor ganho só aparece se o próprio artista ativar "Mostrar os meus ganhos no ranking".
 */
export type RankMetric = "fans" | "unlocks" | "followers";
export const RANK_METRICS: { key: RankMetric; label: string }[] = [
  { key: "fans", label: "Fãs" },
  { key: "unlocks", label: "Desbloqueios" },
  { key: "followers", label: "Seguidores" },
];
const LUANDA = 3600_000;

/** Semana de segunda a domingo (hora de Luanda). offset -1 = semana passada. */
export function weekRange(now = new Date(), offset = 0) {
  const l = new Date(now.getTime() + LUANDA);
  const dow = (l.getUTCDay() + 6) % 7; // 0 = segunda
  const startL = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - dow + offset * 7);
  return { from: new Date(startL - LUANDA), to: new Date(startL - LUANDA + 7 * 86400000) };
}

/** Mês civil (hora de Luanda). offset -1 = mês passado. */
export function monthRangeLuanda(now = new Date(), offset = 0) {
  const l = new Date(now.getTime() + LUANDA);
  const from = Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + offset, 1) - LUANDA;
  const to = Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + offset + 1, 1) - LUANDA;
  return { from: new Date(from), to: new Date(to) };
}

export type RankRow = {
  artistId: string; stageName: string; slug: string; photoKey: string | null; founderNumber: number | null; verified: boolean;
  fans: number; unlocks: number; followers: number; earnedCents: number | null;
};

export async function creatorRanking(db: PrismaClient, r: { from: Date; to: Date }): Promise<RankRow[]> {
  const [fans, unlocks, followers, earnings, artists] = await Promise.all([
    db.$queryRaw<{ artistId: string; n: bigint }[]>`
      SELECT "artistId", COUNT(DISTINCT "userId") AS n FROM "WatchLog"
      WHERE day >= ${r.from} AND day < ${r.to} GROUP BY "artistId"`,
    db.$queryRaw<{ artistId: string; n: bigint }[]>`
      SELECT s."artistId", COUNT(*) AS n FROM "Entitlement" en
      JOIN "Episode" e ON e.id = en."episodeId" JOIN "Series" s ON s.id = e."seriesId"
      WHERE en.source = 'COINS' AND en."createdAt" >= ${r.from} AND en."createdAt" < ${r.to} GROUP BY s."artistId"`,
    db.follow.groupBy({ by: ["artistId"], where: { createdAt: { gte: r.from, lt: r.to } }, _count: true }),
    db.$queryRaw<{ artistId: string; cents: bigint }[]>`
      SELECT a."artistId", -SUM(l."amountCents") AS cents FROM "LedgerLine" l
      JOIN "LedgerAccount" a ON a.id = l."accountId" JOIN "JournalEntry" j ON j.id = l."entryId"
      WHERE (a.code LIKE 'artist:%:available' OR a.code LIKE 'artist:%:pending')
        AND j.kind IN (${Prisma.join([...EARNING_KINDS])}) AND l."createdAt" >= ${r.from} AND l."createdAt" < ${r.to}
      GROUP BY a."artistId"`,
    db.artistProfile.findMany({
      where: { status: "APPROVED" },
      select: { id: true, stageName: true, slug: true, photoKey: true, founderNumber: true, verifiedAt: true, showEarningsInRanking: true },
    }),
  ]);
  const f = new Map(fans.map((x) => [x.artistId, Number(x.n)]));
  const u = new Map(unlocks.map((x) => [x.artistId, Number(x.n)]));
  const fo = new Map(followers.map((x) => [x.artistId, x._count]));
  const e = new Map(earnings.map((x) => [x.artistId, Number(x.cents)]));
  return artists
    .map((a) => ({
      artistId: a.id, stageName: a.stageName, slug: a.slug, photoKey: a.photoKey, founderNumber: a.founderNumber, verified: !!a.verifiedAt,
      fans: f.get(a.id) ?? 0, unlocks: u.get(a.id) ?? 0, followers: fo.get(a.id) ?? 0,
      // Ganhos só se o artista autorizou (desligado por defeito)
      earnedCents: a.showEarningsInRanking ? Math.max(0, e.get(a.id) ?? 0) : null,
    }))
    .filter((x) => x.fans + x.unlocks + x.followers > 0);
}

const ORDER: Record<RankMetric, RankMetric[]> = {
  fans: ["fans", "unlocks", "followers"],
  unlocks: ["unlocks", "fans", "followers"],
  followers: ["followers", "fans", "unlocks"],
};

export function sortRanking(rows: RankRow[], metric: RankMetric) {
  const keys = ORDER[metric];
  return [...rows].sort((a, b) => {
    for (const k of keys) if (b[k] !== a[k]) return b[k] - a[k];
    return a.stageName.localeCompare(b.stageName);
  });
}

/** Lugar do artista na semana (por desbloqueios), comparado com a semana passada. */
export async function weeklyPosition(db: PrismaClient, artistId: string, now = new Date()) {
  const [cur, prev] = await Promise.all([creatorRanking(db, weekRange(now)), creatorRanking(db, weekRange(now, -1))]);
  const pos = sortRanking(cur, "unlocks").findIndex((r) => r.artistId === artistId) + 1;
  const prevPos = sortRanking(prev, "unlocks").findIndex((r) => r.artistId === artistId) + 1;
  return { position: pos || null, previous: prevPos || null, total: cur.length };
}

/** Rei/Rainha da KONTA: 1.º lugar do mês passado (por fãs). */
export async function monthlyKing(db: PrismaClient, now = new Date()) {
  const rows = sortRanking(await creatorRanking(db, monthRangeLuanda(now, -1)), "fans");
  return rows[0] ?? null;
}
