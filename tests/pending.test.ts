import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import { confirmPayment, createCoinPaymentRequest, reversePayment } from "@/domain/payments/service";
import { sendGiftWithCoins, unlockEpisodeWithCoins } from "@/domain/coins/service";
import { getArtistWallet, ledgerIsBalanced, pendingSchedule, releaseDuePending } from "@/domain/money/ledger";
import { requestPayout } from "@/domain/payouts/service";
import { artistMoneySnapshot } from "@/domain/artists/growth";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb(); // pendente por defeito: 3 dias
  await db.coinPack.create({ data: { id: "p1000", priceKz: 1000, coins: 100, sortOrder: 1 } });
  await db.giftType.create({ data: { code: "MIMO", label: "Mimo", emoji: "💝", priceCoins: 10 } });
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

const D = 86_400_000;
async function buy(userId: string) {
  const admin = await makeUser(db, "ADMIN");
  const p = await createCoinPaymentRequest(db, { userId, packId: "p1000", method: "MULTICAIXA_EXPRESS", payerPhone: "+244923000000", transactionRef: `R${Math.random().toString(36).slice(2, 12)}`, proofHash: randomHash(), storeProof: async () => "k" });
  await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
  return { p, admin };
}

describe("Pendente de 3 dias", () => {
  it("episódios e presentes entram como pendentes, com data, e passam sozinhos a disponível", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await db.artistProfile.update({ where: { id: artist.id }, data: { createdAt: new Date(Date.now() - 400 * D) } });
    const fan = await makeUser(db);
    await buy(fan.id);
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id }); // 100 Kz
    await sendGiftWithCoins(db, { userId: fan.id, artistId: artist.id, giftCode: "MIMO" }); // 50 Kz
    let w = await getArtistWallet(db, artist.id);
    expect(w.pendingCents).toBe(15000);
    expect(w.availableCents).toBe(0);
    expect(w.earnedTotalCents).toBe(15000);
    const sched = await pendingSchedule(db, artist.id);
    expect(sched).toHaveLength(1);
    expect(Math.round((sched[0].availableAt.getTime() - Date.now()) / D)).toBe(3);
    expect((await artistMoneySnapshot(db, artist.id)).pendingSchedule[0].daysLeft).toBe(3);
    // não dá para levantar o pendente
    await db.payoutAccount.create({ data: { artistId: artist.id, method: "MULTICAIXA_EXPRESS", holderName: "X", mcxPhone: "+244923000000" } });
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 500000 })).rejects.toThrow(/insuficiente/);
    // ainda não: nada passa
    expect(await releaseDuePending(db, { now: new Date(Date.now() + 2 * D) })).toBe(0);
    // passados 3 dias: passa sozinho, uma vez
    expect(await releaseDuePending(db, { now: new Date(Date.now() + 3 * D + 60_000) })).toBeGreaterThan(0);
    expect(await releaseDuePending(db, { now: new Date(Date.now() + 4 * D) })).toBe(0);
    w = await getArtistWallet(db, artist.id);
    expect([w.pendingCents, w.availableCents, w.earnedTotalCents]).toEqual([0, 15000, 15000]);
  });

  it("compra anulada durante o período: o ganho sai do pendente e o disponível não é tocado", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await db.artistProfile.update({ where: { id: artist.id }, data: { createdAt: new Date(Date.now() - 400 * D) } });
    const fan = await makeUser(db);
    // um ganho antigo já disponível
    await db.setting.upsert({ where: { key: "pendingDays" }, create: { key: "pendingDays", value: "0" }, update: { value: "0" } });
    const good = await makeUser(db);
    await buy(good.id);
    await unlockEpisodeWithCoins(db, { userId: good.id, episodeId: episodes[1].id });
    await db.setting.update({ where: { key: "pendingDays" }, data: { value: "3" } });
    // compra falsa, gasta, depois anulada
    const { p, admin } = await buy(fan.id);
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[2].id });
    let w = await getArtistWallet(db, artist.id);
    expect([w.availableCents, w.pendingCents]).toEqual([10000, 10000]);
    await reversePayment(db, { paymentId: p.id, adminId: admin.id, reason: "falso" });
    w = await getArtistWallet(db, artist.id);
    expect([w.availableCents, w.pendingCents]).toEqual([10000, 0]);
    // e nunca chega a passar a disponível
    await releaseDuePending(db, { now: new Date(Date.now() + 5 * D) });
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(10000);
  });

  it("bónus da plataforma (marcos, kamba) ficam disponíveis de imediato", async () => {
    const inviter = await makeArtistWithSeries(db);
    const { artist, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await db.artistProfile.update({ where: { id: artist.id }, data: { invitedByArtistId: inviter.artist.id } });
    const fan = await makeUser(db);
    await buy(fan.id);
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id });
    const w = await getArtistWallet(db, inviter.artist.id);
    expect(w.availableCents).toBe(200000);
    expect(w.pendingCents).toBe(0);
  });
});
