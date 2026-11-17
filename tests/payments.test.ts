import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import {
  confirmPayment,
  createEpisodePaymentRequest,
  rejectPayment,
  reversePayment,
} from "@/domain/payments/service";
import { balance, getArtistWallet, ledgerIsBalanced } from "@/domain/money/ledger";
import { PLATFORM_CASH, PLATFORM_REVENUE } from "@/domain/money/accounts";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

async function request(userId: string, episodeId: string, opts: { hash?: string; ref?: string } = {}) {
  return createEpisodePaymentRequest(db, {
    userId,
    episodeId,
    method: "MULTICAIXA_EXPRESS",
    payerPhone: "+244923000000",
    transactionRef: opts.ref ?? `REF${Math.random().toString(36).slice(2, 10)}`,
    proofHash: opts.hash ?? randomHash(),
    storeProof: async () => "proofs/test.jpg",
  });
}

describe("Pagamento manual de episódio", () => {
  it("confirmar: desbloqueia o episódio e credita 50% DISPONÍVEL ao artista", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db, { priceCents: 10000, freeEpisodes: 2 });
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const ep3 = episodes[2];

    const p = await request(fan.id, ep3.id);
    expect(p.status).toBe("PENDING");
    expect(p.amountCents).toBe(10000);

    // Antes de confirmar: nada creditado, nada desbloqueado
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(0);

    await confirmPayment(db, { paymentId: p.id, adminId: admin.id });

    const wallet = await getArtistWallet(db, artist.id);
    expect(wallet.availableCents).toBe(5000);
    expect(wallet.earnedTotalCents).toBe(5000);
    expect(wallet.earnedThisMonthCents).toBe(5000);
    const ent = await db.entitlement.findUnique({ where: { userId_episodeId: { userId: fan.id, episodeId: ep3.id } } });
    expect(ent?.source).toBe("PAYMENT");

    const confirmed = await db.paymentRequest.findUniqueOrThrow({ where: { id: p.id } });
    expect(confirmed.reviewedById).toBe(admin.id); // registo de quem confirmou
    expect(await db.notification.count({ where: { userId: fan.id } })).toBe(1);
  });

  it("não é possível confirmar o mesmo pedido duas vezes (nem creditar a dobrar)", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const p = await request(fan.id, episodes[2].id);
    await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    await expect(confirmPayment(db, { paymentId: p.id, adminId: admin.id })).rejects.toThrow();
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(5000);
  });

  it("confirmações em simultâneo só creditam uma vez", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const p = await request(fan.id, episodes[2].id);
    const results = await Promise.allSettled([
      confirmPayment(db, { paymentId: p.id, adminId: admin.id }),
      confirmPayment(db, { paymentId: p.id, adminId: admin.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(5000);
  });

  it("rejeitar: não credita nada e não desbloqueia", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const p = await request(fan.id, episodes[2].id);
    await rejectPayment(db, { paymentId: p.id, adminId: admin.id, reason: "Valor errado" });
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(0);
    expect(await db.entitlement.count({ where: { userId: fan.id } })).toBe(0);
    await expect(confirmPayment(db, { paymentId: p.id, adminId: admin.id })).rejects.toThrow();
  });

  it("anular (reembolso) um pagamento confirmado: retira o acesso e devolve os saldos a zero", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const cashBefore = await balance(db, PLATFORM_CASH);
    const revenueBefore = await balance(db, PLATFORM_REVENUE);
    const p = await request(fan.id, episodes[2].id);
    await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    await reversePayment(db, { paymentId: p.id, adminId: admin.id, reason: "Transferência falsa" });

    const w = await getArtistWallet(db, artist.id);
    expect(w.availableCents).toBe(0);
    expect(w.earnedTotalCents).toBe(0);
    expect(await balance(db, PLATFORM_CASH)).toBe(cashBefore);
    expect(await balance(db, PLATFORM_REVENUE)).toBe(revenueBefore);
    expect(await db.entitlement.count({ where: { userId: fan.id } })).toBe(0);
    // não se pode anular duas vezes
    await expect(reversePayment(db, { paymentId: p.id, adminId: admin.id, reason: "x de novo" })).rejects.toThrow();
  });

  it("o mesmo comprovativo (ficheiro ou n.º de operação) não pode ser usado duas vezes", async () => {
    const { episodes } = await makeArtistWithSeries(db);
    const fan1 = await makeUser(db);
    const fan2 = await makeUser(db);
    const hash = randomHash();
    await request(fan1.id, episodes[2].id, { hash, ref: "ABC-123-XYZ" });
    await expect(request(fan2.id, episodes[2].id, { hash })).rejects.toThrow(/já foi usado/);
    await expect(request(fan2.id, episodes[2].id, { ref: "abc 123 xyz" })).rejects.toThrow(/já foi usado/);
  });

  it("limite de pedidos pendentes por utilizador", async () => {
    const fan = await makeUser(db);
    const eps = [];
    for (let i = 0; i < 4; i++) eps.push((await makeArtistWithSeries(db)).episodes[2]);
    await request(fan.id, eps[0].id);
    await request(fan.id, eps[1].id);
    await request(fan.id, eps[2].id);
    await expect(request(fan.id, eps[3].id)).rejects.toThrow(/aguardar confirmação/);
  });

  it("não aceita pagamento de episódios grátis nem pedidos repetidos para o mesmo episódio", async () => {
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 2 });
    const fan = await makeUser(db);
    await expect(request(fan.id, episodes[0].id)).rejects.toThrow(/grátis/);
    await request(fan.id, episodes[3].id);
    await expect(request(fan.id, episodes[3].id)).rejects.toThrow(/já tens um pedido/i);
  });

  it("episódios desbloqueados com pontos NÃO geram pagamento ao artista", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    await db.entitlement.create({ data: { userId: fan.id, episodeId: episodes[2].id, source: "POINTS" } });
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(0);
    expect(await db.ledgerLine.count({ where: { account: { artistId: artist.id } } })).toBe(0);
  });
});
