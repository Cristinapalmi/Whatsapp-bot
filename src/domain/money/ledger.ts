import type { Prisma, PrismaClient } from "@prisma/client";
import { MoneyError } from "./split";
import { EARNING_KINDS, artistAvailable, artistPayout, artistPending, type AccountSpec } from "./accounts";
import { startOfMonthUtc } from "@/lib/dates";

/**
 * LIVRO-RAZÃO DE DUPLA ENTRADA.
 * Regra de ouro: nenhum saldo é guardado ou alterado diretamente.
 * Todo o movimento é um lançamento (JournalEntry) com linhas que somam ZERO.
 * Débito = valor positivo; Crédito = valor negativo.
 * Saldos de PASSIVO/RECEITA (ex.: carteira do artista) = −(soma das linhas).
 */

export type Tx = Prisma.TransactionClient | PrismaClient;

export async function ensureAccount(tx: Tx, spec: AccountSpec) {
  return tx.ledgerAccount.upsert({
    where: { code: spec.code },
    update: {},
    create: { code: spec.code, name: spec.name, type: spec.type, artistId: spec.artistId },
  });
}

export type PostEntryInput = {
  kind: string;
  description: string;
  idempotencyKey: string;
  lines: { account: AccountSpec; amountCents: number }[];
  paymentRequestId?: string;
  payoutRequestId?: string;
  createdById?: string;
  /** Ganho que entra como pendente: data em que passa a disponível. */
  availableAt?: Date | null;
};

export async function postEntry(tx: Tx, input: PostEntryInput) {
  const lines = input.lines.filter((l) => l.amountCents !== 0);
  if (lines.length < 2) throw new MoneyError("Um lançamento precisa de pelo menos duas linhas");
  for (const l of lines) {
    if (!Number.isInteger(l.amountCents)) throw new MoneyError("Valores têm de ser inteiros (cêntimos)");
  }
  const sum = lines.reduce((a, l) => a + l.amountCents, 0);
  if (sum !== 0) throw new MoneyError(`Lançamento desequilibrado (soma = ${sum})`);

  const accountIds: string[] = [];
  for (const l of lines) accountIds.push((await ensureAccount(tx, l.account)).id);

  return tx.journalEntry.create({
    data: {
      kind: input.kind,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      paymentRequestId: input.paymentRequestId,
      payoutRequestId: input.payoutRequestId,
      createdById: input.createdById,
      availableAt: input.availableAt ?? null,
      lines: { create: lines.map((l, i) => ({ accountId: accountIds[i], amountCents: l.amountCents })) },
    },
    include: { lines: true },
  });
}

/** Soma bruta das linhas de uma conta (débitos − créditos). */
export async function rawBalance(tx: Tx, code: string): Promise<number> {
  const agg = await tx.ledgerLine.aggregate({ where: { account: { code } }, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0;
}

/** Saldo "natural": positivo para ativos; para passivos/receitas inverte o sinal. */
export async function balance(tx: Tx, spec: AccountSpec): Promise<number> {
  const raw = await rawBalance(tx, spec.code);
  return spec.type === "ASSET" || spec.type === "EXPENSE" ? raw : 0 - raw || 0;
}

/** Bloqueia a conta (linha na BD) até ao fim da transação — evita levantamentos em duplicado. */
export async function lockAccount(tx: Prisma.TransactionClient, spec: AccountSpec) {
  await ensureAccount(tx, spec);
  await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE code = ${spec.code} FOR UPDATE`;
}

export type ArtistWallet = {
  availableCents: number;
  pendingCents: number;
  processingCents: number;
  earnedThisMonthCents: number;
  earnedTotalCents: number;
};

export async function getArtistWallet(tx: Tx, artistId: string, now = new Date()): Promise<ArtistWallet> {
  // Ganhos = linhas de ganho nas contas disponível E pendente (a passagem pendente → disponível não conta duas vezes)
  const earningWhere = { account: { code: { in: [artistAvailable(artistId).code, artistPending(artistId).code] } }, entry: { kind: { in: [...EARNING_KINDS] } } };
  const [availableCents, pendingCents, processingCents, total, month] = await Promise.all([
    balance(tx, artistAvailable(artistId)),
    balance(tx, artistPending(artistId)),
    balance(tx, artistPayout(artistId)),
    tx.ledgerLine.aggregate({ where: earningWhere, _sum: { amountCents: true } }),
    tx.ledgerLine.aggregate({
      where: { ...earningWhere, createdAt: { gte: startOfMonthUtc(now) } },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    availableCents,
    pendingCents,
    processingCents,
    earnedTotalCents: 0 - (total._sum.amountCents ?? 0) || 0,
    earnedThisMonthCents: 0 - (month._sum.amountCents ?? 0) || 0,
  };
}

/** Verificação de integridade: a soma de TODAS as linhas tem de ser zero. */
export async function ledgerIsBalanced(tx: Tx): Promise<boolean> {
  const agg = await tx.ledgerLine.aggregate({ _sum: { amountCents: true } });
  return (agg._sum.amountCents ?? 0) === 0;
}


/* ------------------------------------------------------------------ */
/* PENDENTE: os ganhos dos artistas ficam X dias em pendente (editável) */
/* ------------------------------------------------------------------ */

/** Data em que um ganho feito agora fica disponível (null = disponível já). */
export async function pendingUntil(tx: Tx, now = new Date()): Promise<Date | null> {
  const { getInt } = await import("../settings");
  const days = await getInt(tx, "pendingDays");
  return days > 0 ? new Date(now.getTime() + days * 86_400_000) : null;
}

/** Conta onde entra um ganho do artista agora: pendente (com data) ou disponível. */
export async function earningAccount(tx: Tx, artistId: string, now = new Date()) {
  const until = await pendingUntil(tx, now);
  return { account: until ? artistPending(artistId) : artistAvailable(artistId), availableAt: until };
}

/**
 * Passa para "Disponível" os ganhos cuja data já chegou. Cada lançamento passa uma única vez
 * (e nunca se já foi anulado). Opcionalmente só de um artista.
 */
export async function releaseDuePending(db: PrismaClient, opts: { artistId?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const entries = await db.journalEntry.findMany({
    where: {
      availableAt: { lte: now },
      releasedAt: null,
      cancelledAt: null,
      lines: { some: { account: opts.artistId ? { code: artistPending(opts.artistId).code } : { code: { endsWith: ":pending", startsWith: "artist:" } } } },
    },
    include: { lines: { include: { account: true } } },
    take: 500,
  });
  let released = 0;
  for (const e of entries) {
    await db.$transaction(async (tx) => {
      const claim = await tx.journalEntry.updateMany({ where: { id: e.id, releasedAt: null, cancelledAt: null }, data: { releasedAt: now } });
      if (claim.count !== 1) return;
      const lines: PostEntryInput["lines"] = [];
      for (const l of e.lines) {
        const m = /^artist:(.+):pending$/.exec(l.account.code);
        if (!m || l.amountCents >= 0) continue;
        lines.push({ account: artistPending(m[1]), amountCents: -l.amountCents }, { account: artistAvailable(m[1]), amountCents: l.amountCents });
      }
      if (lines.length) {
        await postEntry(tx, { kind: "EARNING_RELEASED", description: `Disponível: ${e.description}`, idempotencyKey: `release:${e.id}` , lines });
        released++;
      }
    });
  }
  return released;
}

/** Pendente de um artista agrupado pela data em que fica disponível. */
export async function pendingSchedule(tx: Tx, artistId: string) {
  const code = artistPending(artistId).code;
  const entries = await tx.journalEntry.findMany({
    where: { releasedAt: null, cancelledAt: null, availableAt: { not: null }, lines: { some: { account: { code } } } },
    include: { lines: { where: { account: { code } } } },
    orderBy: { availableAt: "asc" },
  });
  const byDay = new Map<string, { availableAt: Date; cents: number }>();
  for (const e of entries) {
    const cents = e.lines.reduce((a, l) => a - l.amountCents, 0);
    if (cents === 0) continue;
    const key = e.availableAt!.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { availableAt: e.availableAt!, cents: 0 };
    cur.cents += cents;
    if (e.availableAt! > cur.availableAt) cur.availableAt = e.availableAt!;
    byDay.set(key, cur);
  }
  return [...byDay.values()];
}
