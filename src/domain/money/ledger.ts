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
  const availableCode = artistAvailable(artistId).code;
  const earningWhere = { account: { code: availableCode }, entry: { kind: { in: [...EARNING_KINDS] } } };
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
