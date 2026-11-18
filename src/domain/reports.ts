import type { Tx } from "./money/ledger";
import { artistAvailable } from "./money/accounts";
import { monthRange } from "./ranking";

/**
 * RELATÓRIOS E EXPORTAÇÕES (mês de Luanda).
 * Tudo é calculado a partir do livro-razão — os números batem sempre certo com as carteiras.
 */

export type StatementLine = {
  date: Date;
  type: "EPISODE" | "GIFT" | "PASS" | "ADS" | "REVERSAL" | "PAYOUT_REQUEST" | "PAYOUT_RETURNED" | "OTHER";
  description: string;
  /** Positivo = entrou na carteira; negativo = saiu. */
  amountCents: number;
};

export const STATEMENT_LABELS: Record<StatementLine["type"], string> = {
  EPISODE: "Venda de episódio",
  GIFT: "Presente",
  PASS: "Passe semanal",
  ADS: "Anúncios",
  REVERSAL: "Pagamento anulado",
  PAYOUT_REQUEST: "Levantamento",
  PAYOUT_RETURNED: "Levantamento devolvido",
  OTHER: "Outro",
};

function classify(entryKind: string, paymentKind: string | null | undefined): StatementLine["type"] {
  if (entryKind === "PAYMENT_CONFIRMED") return paymentKind === "GIFT" ? "GIFT" : paymentKind === "EPISODE" ? "EPISODE" : "OTHER";
  if (entryKind === "AD_DISTRIBUTION") return "ADS";
  if (entryKind === "COIN_SPEND_EPISODE") return "EPISODE";
  if (entryKind === "COIN_SPEND_GIFT") return "GIFT";
  if (entryKind === "COIN_SPEND_REVERSED") return "REVERSAL";
  if (entryKind === "PASS_DISTRIBUTION" || entryKind === "PASS_ROLLOVER") return "PASS";
  if (entryKind === "PAYMENT_REVERSED") return "REVERSAL";
  if (entryKind === "PAYOUT_REQUESTED") return "PAYOUT_REQUEST";
  if (entryKind === "PAYOUT_REJECTED") return "PAYOUT_RETURNED";
  return "OTHER";
}

/** Extrato mensal da carteira (saldo disponível) de um artista. */
export async function artistStatement(db: Tx, artistId: string, month?: string) {
  const r = monthRange(month);
  const code = artistAvailable(artistId).code;
  const [before, lines, paidPayouts] = await Promise.all([
    db.ledgerLine.aggregate({ where: { account: { code }, createdAt: { lt: r.from } }, _sum: { amountCents: true } }),
    db.ledgerLine.findMany({
      where: { account: { code }, createdAt: { gte: r.from, lt: r.to } },
      include: { entry: { include: { paymentRequest: { select: { kind: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    db.payoutRequest.aggregate({ where: { artistId, status: "PAID", processedAt: { gte: r.from, lt: r.to } }, _sum: { amountCents: true }, _count: true }),
  ]);
  const opening = 0 - (before._sum.amountCents ?? 0) || 0;
  const movements: StatementLine[] = lines.map((l) => ({
    date: l.createdAt,
    type: classify(l.entry.kind, l.entry.paymentRequest?.kind),
    description: l.entry.description,
    amountCents: 0 - l.amountCents || 0, // passivo: crédito (negativo) = entrada para o artista
  }));
  const totals = Object.fromEntries(Object.keys(STATEMENT_LABELS).map((k) => [k, 0])) as Record<StatementLine["type"], number>;
  for (const m of movements) totals[m.type] += m.amountCents;
  const earned = totals.EPISODE + totals.GIFT + totals.PASS + totals.ADS + totals.REVERSAL;
  const closing = opening + movements.reduce((a, m) => a + m.amountCents, 0);
  return {
    month: r.key,
    openingCents: opening,
    closingCents: closing,
    earnedCents: earned,
    totals,
    payoutsPaid: { count: paidPayouts._count, cents: paidPayouts._sum.amountCents ?? 0 },
    movements,
  };
}

/** Resumo de ganhos de todos os artistas no mês. */
export async function artistsEarningsSummary(db: Tx, month?: string) {
  const artists = await db.artistProfile.findMany({ orderBy: { stageName: "asc" }, select: { id: true, stageName: true, fullName: true, biNumber: true, status: true } });
  const out = [];
  for (const a of artists) {
    const s = await artistStatement(db, a.id, month);
    if (s.movements.length === 0 && s.openingCents === 0) continue;
    out.push({ artist: a, ...s });
  }
  return out;
}

/** Pagamentos do público no mês (pedidos criados no mês). */
export async function paymentsInMonth(db: Tx, month?: string) {
  const r = monthRange(month);
  return db.paymentRequest.findMany({
    where: { createdAt: { gte: r.from, lt: r.to } },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true, phone: true } },
      artist: { select: { stageName: true } },
      episode: { select: { number: true, series: { select: { title: true } } } },
      reviewedBy: { select: { name: true } },
    },
  });
}

/** Linhas do livro-razão no mês (para o contabilista). */
export async function ledgerInMonth(db: Tx, month?: string) {
  const r = monthRange(month);
  return db.ledgerLine.findMany({
    where: { createdAt: { gte: r.from, lt: r.to } },
    orderBy: [{ createdAt: "asc" }, { entryId: "asc" }],
    include: { account: true, entry: { include: { createdBy: { select: { name: true } } } } },
  });
}

/** Desempenho de cada série no mês. */
export async function seriesReport(db: Tx, month?: string) {
  const r = monthRange(month);
  const series = await db.series.findMany({
    where: { status: { in: ["PUBLISHED", "HIDDEN"] } },
    include: { artist: { select: { stageName: true } }, episodes: { select: { id: true, number: true } } },
    orderBy: { title: "asc" },
  });
  const out = [];
  for (const s of series) {
    const epIds = s.episodes.map((e) => e.id);
    const paidIds = s.episodes.filter((e) => e.number > s.freeEpisodes).map((e) => e.id);
    const [logs, viewers, completions, sales, buyers] = await Promise.all([
      db.watchLog.aggregate({ where: { episodeId: { in: epIds }, day: { gte: r.fromDay, lt: r.toDay } }, _sum: { seconds: true } }),
      db.watchLog.findMany({ where: { episodeId: { in: epIds }, day: { gte: r.fromDay, lt: r.toDay } }, distinct: ["userId"], select: { userId: true } }),
      db.watchProgress.count({ where: { episodeId: { in: epIds }, completedAt: { gte: r.from, lt: r.to } } }),
      db.paymentRequest.aggregate({ where: { episodeId: { in: paidIds }, status: "CONFIRMED", reviewedAt: { gte: r.from, lt: r.to } }, _sum: { amountCents: true }, _count: true }),
      db.paymentRequest.findMany({ where: { episodeId: { in: paidIds }, status: "CONFIRMED", reviewedAt: { gte: r.from, lt: r.to } }, distinct: ["userId"], select: { userId: true } }),
    ]);
    out.push({
      title: s.title,
      artist: s.artist.stageName,
      status: s.status,
      viewers: viewers.length,
      minutes: Math.round((logs._sum.seconds ?? 0) / 60),
      completions,
      salesCount: sales._count,
      salesCents: sales._sum.amountCents ?? 0,
      buyers: buyers.length,
      conversionPct: viewers.length ? (buyers.length / viewers.length) * 100 : 0,
    });
  }
  return out;
}

/** Período a partir de datas "AAAA-MM-DD" (hora de Luanda); por defeito, o mês atual. */
export function periodRange(de?: string, ate?: string) {
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const m = monthRange();
  const from = ok(de) ? new Date(`${de}T00:00:00+01:00`) : m.from;
  const toExclusive = ok(ate) ? new Date(new Date(`${ate}T00:00:00+01:00`).getTime() + 86400000) : m.to;
  const fmt = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
  return { from, to: toExclusive, de: fmt(from), ate: fmt(new Date(toExclusive.getTime() - 1)) };
}

/**
 * RELATÓRIO FINANCEIRO DAS MOEDAS num período.
 *  - vendidas: compras confirmadas no período (valor pago, comissões, valor líquido)
 *  - gastas: moedas gastas no período (valor real), parte dos criadores e da plataforma
 *  - por gastar: saldo atual (independente do período)
 */
export async function coinFinancialReport(db: Tx, from: Date, to: Date) {
  const [purchases, spends, outstanding, outstandingLedger, owedAgg, pendingPayouts, pendingCoinPayments, adRevenue, adUnlocks, adDistributed, adPools] = await Promise.all([
    db.paymentRequest.findMany({
      where: { kind: "COINS", status: { in: ["CONFIRMED", "REVERSED"] }, reviewedAt: { gte: from, lt: to } },
      orderBy: { reviewedAt: "asc" },
      include: { user: { select: { name: true, phone: true } }, reviewedBy: { select: { name: true } } },
    }),
    db.coinSpend.findMany({ where: { createdAt: { gte: from, lt: to }, reversedAt: null }, select: { kind: true, coins: true, valueCents: true, artistCents: true } }),
    db.coinLot.aggregate({ where: { revokedAt: null }, _sum: { coinsRemaining: true, valueRemainingCents: true } }),
    db.ledgerLine.aggregate({ where: { account: { code: "coins:outstanding" } }, _sum: { amountCents: true } }),
    db.ledgerLine.aggregate({ where: { account: { code: { startsWith: "artist:" } } }, _sum: { amountCents: true } }),
    db.payoutRequest.aggregate({ where: { status: "PROCESSING" }, _count: true, _sum: { amountCents: true } }),
    db.paymentRequest.count({ where: { kind: "COINS", status: "PENDING" } }),
    db.adRevenue.aggregate({ where: { createdAt: { gte: from, lt: to } }, _sum: { amountCents: true }, _count: true }),
    db.adUnlock.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.ledgerLine.aggregate({
      where: { createdAt: { gte: from, lt: to }, entry: { kind: "AD_DISTRIBUTION" }, account: { code: { startsWith: "artist:" } } },
      _sum: { amountCents: true },
    }),
    db.ledgerLine.aggregate({ where: { account: { code: { startsWith: "ad-pool:" } } }, _sum: { amountCents: true } }),
  ]);
  const confirmed = purchases.filter((p) => p.status === "CONFIRMED");
  const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0);
  const spentValue = sum(spends, (s) => s.valueCents);
  const creatorsCents = sum(spends, (s) => s.artistCents);
  return {
    sold: {
      purchases: confirmed.length,
      coins: sum(confirmed, (p) => p.coins ?? 0),
      grossCents: sum(confirmed, (p) => p.amountCents),
      feesCents: sum(confirmed, (p) => p.feeCents),
      netCents: sum(confirmed, (p) => p.amountCents - p.feeCents),
      reversed: purchases.length - confirmed.length,
    },
    spent: {
      coins: sum(spends, (s) => s.coins),
      episodes: spends.filter((s) => s.kind === "EPISODE").length,
      gifts: spends.filter((s) => s.kind === "GIFT").length,
      valueCents: spentValue,
      creatorsCents,
      platformCents: spentValue - creatorsCents,
    },
    outstanding: {
      coins: outstanding._sum.coinsRemaining ?? 0,
      valueCents: outstanding._sum.valueRemainingCents ?? 0,
      ledgerCents: 0 - (outstandingLedger._sum.amountCents ?? 0) || 0,
    },
    ads: {
      revenueCents: adRevenue._sum.amountCents ?? 0,
      revenueEntries: adRevenue._count,
      unlocks: adUnlocks,
      distributedToCreatorsCents: 0 - (adDistributed._sum.amountCents ?? 0) || 0,
      poolsNowCents: 0 - (adPools._sum.amountCents ?? 0) || 0,
    },
    owedToCreatorsCents: 0 - (owedAgg._sum.amountCents ?? 0) || 0,
    pendingPayouts: { count: pendingPayouts._count, cents: pendingPayouts._sum.amountCents ?? 0 },
    pendingCoinPayments,
    purchases,
  };
}
