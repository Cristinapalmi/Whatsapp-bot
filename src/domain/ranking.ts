import { Prisma } from "@prisma/client";
import type { Tx } from "./money/ledger";
import { EARNING_KINDS } from "./money/accounts";

/**
 * "DISPUTA DOS ARTISTAS" — ranking mensal (mês de Luanda).
 *  - visualizações: pares (fã, episódio) diferentes vistos no mês
 *  - minutos vistos no mês
 *  - receita: o que o artista ganhou no mês (episódios, presentes, passe)
 */

export type RankingRow = {
  artistId: string;
  stageName: string;
  slug: string;
  views: number;
  minutes: number;
  earnedCents: number;
};

export function monthRange(month?: string) {
  const now = new Date(Date.now() + 3600_000);
  const [y, m] = month && /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  return {
    key: `${y}-${String(m).padStart(2, "0")}`,
    // datas (dia) para WatchLog, e instantes (Luanda = UTC+1) para o livro-razão
    fromDay: new Date(Date.UTC(y, m - 1, 1)),
    toDay: new Date(Date.UTC(y, m, 1)),
    from: new Date(Date.UTC(y, m - 1, 1) - 3600_000),
    to: new Date(Date.UTC(y, m, 1) - 3600_000),
  };
}

export async function monthlyRanking(db: Tx, month?: string): Promise<RankingRow[]> {
  const r = monthRange(month);
  const views = await db.$queryRaw<{ artistId: string; views: bigint; seconds: bigint }[]>`
    SELECT "artistId", COUNT(DISTINCT ("userId", "episodeId")) AS views, COALESCE(SUM(seconds), 0) AS seconds
    FROM "WatchLog" WHERE day >= ${r.fromDay} AND day < ${r.toDay}
    GROUP BY "artistId"`;
  const earnings = await db.$queryRaw<{ artistId: string; cents: bigint }[]>`
    SELECT a."artistId", -SUM(l."amountCents") AS cents
    FROM "LedgerLine" l
    JOIN "LedgerAccount" a ON a.id = l."accountId"
    JOIN "JournalEntry" e ON e.id = l."entryId"
    WHERE (a.code LIKE 'artist:%:available' OR a.code LIKE 'artist:%:pending')
      AND e.kind IN (${Prisma.join([...EARNING_KINDS])})
      AND l."createdAt" >= ${r.from} AND l."createdAt" < ${r.to}
    GROUP BY a."artistId"`;
  const artists = await db.artistProfile.findMany({ where: { status: "APPROVED" }, select: { id: true, stageName: true, slug: true } });
  const v = new Map(views.map((x) => [x.artistId, x]));
  const e = new Map(earnings.map((x) => [x.artistId, Number(x.cents)]));
  return artists.map((a) => ({
    artistId: a.id,
    stageName: a.stageName,
    slug: a.slug,
    views: Number(v.get(a.id)?.views ?? 0),
    minutes: Math.round(Number(v.get(a.id)?.seconds ?? 0) / 60),
    earnedCents: e.get(a.id) ?? 0,
  }));
}

export const sortByViews = (rows: RankingRow[]) => [...rows].sort((a, b) => b.views - a.views || b.minutes - a.minutes);
export const sortByRevenue = (rows: RankingRow[]) => [...rows].sort((a, b) => b.earnedCents - a.earnedCents || b.views - a.views);
