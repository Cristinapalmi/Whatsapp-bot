import type { PrismaClient } from "@prisma/client";
import { business } from "@config/business";
import { PLATFORM_CASH, artistAvailable, artistPayout } from "../money/accounts";
import { balance, lockAccount, postEntry, type Tx } from "../money/ledger";
import { getInts } from "../settings";
import { notify, audit } from "../notify";
import { UserFacingError } from "../errors";
import { formatKz, kzToCents } from "@/lib/money";

/**
 * LEVANTAMENTOS DOS ARTISTAS.
 *  1. Pedido  → o valor sai do saldo disponível e fica "em processamento" (reservado).
 *  2. Pago    → a administração transferiu; o valor sai da caixa da plataforma.
 *  3. Rejeitado → o valor volta ao saldo disponível.
 */

/** Mínimo para levantar: o 1.º levantamento é mais baixo (1.000 Kz), os seguintes 5.000 Kz (editáveis). */
export async function payoutMinCents(db: Tx, artistId: string) {
  const [c, before] = await Promise.all([
    getInts(db, ["payoutFirstMinKz", "payoutMinKz"]),
    db.payoutRequest.count({ where: { artistId, status: { in: ["PROCESSING", "PAID"] } } }),
  ]);
  return kzToCents(before === 0 ? c.payoutFirstMinKz : c.payoutMinKz);
}

export async function requestPayout(db: PrismaClient, { artistId, amountCents }: { artistId: string; amountCents: number }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new UserFacingError("Valor inválido.");
  const minCents = await payoutMinCents(db, artistId);
  if (amountCents < minCents) throw new UserFacingError(`O levantamento mínimo é ${formatKz(minCents)}.`);

  return db.$transaction(async (tx) => {
    const artist = await tx.artistProfile.findUniqueOrThrow({ where: { id: artistId }, include: { payoutAccount: true } });
    if (artist.status !== "APPROVED") throw new UserFacingError("A tua conta de artista não está ativa.");
    const acc = artist.payoutAccount;
    if (!acc) throw new UserFacingError("Liga primeiro a conta onde queres receber.");

    // Bloqueia a carteira até ao fim desta operação (impede dois pedidos ao mesmo tempo).
    await lockAccount(tx, artistAvailable(artistId));
    const available = await balance(tx, artistAvailable(artistId));
    if (amountCents > available)
      throw new UserFacingError(`Saldo insuficiente. Disponível: ${formatKz(Math.max(0, available))}.`, "INSUFFICIENT");
    // Sem duplicados: só um levantamento em processamento de cada vez
    if (await tx.payoutRequest.findFirst({ where: { artistId, status: "PROCESSING" } }))
      throw new UserFacingError("Já tens um levantamento em processamento. Espera que seja pago antes de pedir outro.", "PAYOUT_PENDING");

    const payout = await tx.payoutRequest.create({
      data: {
        artistId,
        amountCents,
        method: acc.method,
        holderName: acc.holderName,
        bankName: acc.bankName,
        iban: acc.iban,
        mcxPhone: acc.mcxPhone,
      },
    });
    await postEntry(tx, {
      kind: "PAYOUT_REQUESTED",
      description: `Pedido de levantamento ${payout.id}`,
      idempotencyKey: `payout:${payout.id}:request`,
      payoutRequestId: payout.id,
      lines: [
        { account: artistAvailable(artistId), amountCents },
        { account: artistPayout(artistId), amountCents: -amountCents },
      ],
    });
    await audit(tx, artist.userId, "PAYOUT_REQUESTED", "PayoutRequest", payout.id, { amountCents });
    return payout;
  });
}

export async function markPayoutPaid(
  db: PrismaClient,
  { payoutId, adminId, proofKey, note }: { payoutId: string; adminId: string; proofKey?: string; note?: string },
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.payoutRequest.updateMany({
      where: { id: payoutId, status: "PROCESSING" },
      data: { status: "PAID", processedAt: new Date(), processedById: adminId, proofKey, adminNote: note },
    });
    if (updated.count !== 1) throw new UserFacingError("Este levantamento já foi tratado.");
    const p = await tx.payoutRequest.findUniqueOrThrow({ where: { id: payoutId }, include: { artist: true } });
    await postEntry(tx, {
      kind: "PAYOUT_PAID",
      description: `Levantamento pago ${p.id}`,
      idempotencyKey: `payout:${p.id}:paid`,
      payoutRequestId: p.id,
      createdById: adminId,
      lines: [
        { account: artistPayout(p.artistId), amountCents: p.amountCents },
        { account: PLATFORM_CASH, amountCents: -p.amountCents },
      ],
    });
    await notify(tx, p.artist.userId, "Levantamento pago", `Transferimos ${formatKz(p.amountCents)} para a tua conta.`, "/artista/carteira");
    await audit(tx, adminId, "PAYOUT_PAID", "PayoutRequest", p.id, { proofKey: proofKey ?? null });
    return p;
  });
}

export async function rejectPayout(
  db: PrismaClient,
  { payoutId, adminId, reason }: { payoutId: string; adminId: string; reason: string },
) {
  const r = reason.trim();
  if (r.length < 3) throw new UserFacingError("Indica o motivo.");
  return db.$transaction(async (tx) => {
    const updated = await tx.payoutRequest.updateMany({
      where: { id: payoutId, status: "PROCESSING" },
      data: { status: "REJECTED", processedAt: new Date(), processedById: adminId, adminNote: r },
    });
    if (updated.count !== 1) throw new UserFacingError("Este levantamento já foi tratado.");
    const p = await tx.payoutRequest.findUniqueOrThrow({ where: { id: payoutId }, include: { artist: true } });
    await postEntry(tx, {
      kind: "PAYOUT_REJECTED",
      description: `Levantamento rejeitado ${p.id}: ${r}`,
      idempotencyKey: `payout:${p.id}:reject`,
      payoutRequestId: p.id,
      createdById: adminId,
      lines: [
        { account: artistPayout(p.artistId), amountCents: p.amountCents },
        { account: artistAvailable(p.artistId), amountCents: -p.amountCents },
      ],
    });
    await notify(tx, p.artist.userId, "Levantamento não processado", `O valor voltou à tua carteira. Motivo: ${r}`, "/artista/carteira");
    await audit(tx, adminId, "PAYOUT_REJECTED", "PayoutRequest", p.id, { reason: r });
    return p;
  });
}
