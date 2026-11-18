import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import { confirmPayment, createEpisodePaymentRequest, reversePayment } from "@/domain/payments/service";
import { markPayoutPaid, rejectPayout, requestPayout } from "@/domain/payouts/service";
import { getArtistWallet, ledgerIsBalanced } from "@/domain/money/ledger";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
  // Estes testes verificam outras regras: os ganhos ficam disponíveis logo (o pendente tem testes próprios)
  await db.setting.create({ data: { key: "pendingDays", value: "0" } });
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

/** Cria um artista com X Kz de saldo disponível (através de vendas reais confirmadas). */
async function artistWithBalance(sales: number, priceCents = 15000) {
  const ctx = await makeArtistWithSeries(db, { priceCents, freeEpisodes: 0 });
  const admin = await makeUser(db, "ADMIN");
  const payments = [];
  for (let i = 0; i < sales; i++) {
    const fan = await makeUser(db);
    const p = await createEpisodePaymentRequest(db, {
      userId: fan.id,
      episodeId: ctx.episodes[0].id,
      method: "MULTICAIXA_EXPRESS",
      payerPhone: "+244923000000",
      transactionRef: `R${Math.random().toString(36).slice(2, 12)}`,
      proofHash: randomHash(),
      storeProof: async () => "k",
    });
    await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    payments.push(p);
  }
  await db.payoutAccount.create({
    data: { artistId: ctx.artist.id, holderName: "Nome Completo", method: "MULTICAIXA_EXPRESS", mcxPhone: "+244923111111" },
  });
  return { ...ctx, admin, payments };
}

describe("Levantamentos", () => {
  it("pedido reserva o valor; 'Pago' retira-o; o histórico fica correto", async () => {
    const { artist, admin } = await artistWithBalance(80); // 80 × 75 Kz = 6.000 Kz
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(600000);

    const payout = await requestPayout(db, { artistId: artist.id, amountCents: 500000 });
    let w = await getArtistWallet(db, artist.id);
    expect(w.availableCents).toBe(100000);
    expect(w.processingCents).toBe(500000);

    await markPayoutPaid(db, { payoutId: payout.id, adminId: admin.id, proofKey: "proofs/pago.jpg" });
    w = await getArtistWallet(db, artist.id);
    expect(w.availableCents).toBe(100000);
    expect(w.processingCents).toBe(0);
    expect(w.earnedTotalCents).toBe(600000); // levantar não reduz o "total ganho"
    await expect(markPayoutPaid(db, { payoutId: payout.id, adminId: admin.id })).rejects.toThrow();
  });

  it("não é possível levantar mais do que o saldo disponível", async () => {
    const { artist } = await artistWithBalance(70); // 5.250 Kz
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 600000 })).rejects.toThrow(/insuficiente/);
    await requestPayout(db, { artistId: artist.id, amountCents: 500000 });
    // o resto (250 Kz) está abaixo do mínimo e acima do saldo para outro levantamento de 5.000
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 500000 })).rejects.toThrow(/insuficiente/);
  });

  it("dois pedidos em simultâneo não ultrapassam o saldo", async () => {
    const { artist } = await artistWithBalance(70); // 5.250 Kz
    const results = await Promise.allSettled([
      requestPayout(db, { artistId: artist.id, amountCents: 500000 }),
      requestPayout(db, { artistId: artist.id, amountCents: 500000 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(25000);
  });

  it("respeita o mínimo de levantamento", async () => {
    const { artist } = await artistWithBalance(80);
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 50000 })).rejects.toThrow(/mínimo/); // 1.º: mínimo 1.000 Kz
  });

  it("levantamento rejeitado devolve o valor ao saldo disponível", async () => {
    const { artist, admin } = await artistWithBalance(80);
    const payout = await requestPayout(db, { artistId: artist.id, amountCents: 500000 });
    await rejectPayout(db, { payoutId: payout.id, adminId: admin.id, reason: "IBAN errado" });
    const w = await getArtistWallet(db, artist.id);
    expect(w.availableCents).toBe(600000);
    expect(w.processingCents).toBe(0);
  });

  it("anulação de uma venda com saldo já levantado deixa a carteira negativa e bloqueia levantamentos", async () => {
    const { artist, admin, payments } = await artistWithBalance(67); // 5.025 Kz
    await requestPayout(db, { artistId: artist.id, amountCents: 500000 }); // fica 25 Kz
    await reversePayment(db, { paymentId: payments[0].id, adminId: admin.id, reason: "Comprovativo falso" });
    const w = await getArtistWallet(db, artist.id);
    expect(w.availableCents).toBe(2500 - 7500); // −50 Kz
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 500000 })).rejects.toThrow(/insuficiente/);
  });

  it("artista sem conta ligada não pode levantar", async () => {
    const { artist } = await makeArtistWithSeries(db);
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 500000 })).rejects.toThrow(/Liga primeiro/);
  });
});
