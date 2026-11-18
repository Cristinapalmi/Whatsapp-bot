import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import { confirmPayment, createCoinPaymentRequest } from "@/domain/payments/service";
import { setSetting, unlockEpisodeWithCoins, unlockSeasonWithCoins } from "@/domain/coins/service";
import { assignFounder, foundersLeft, sendDailySummaries, totalPaidToArtists } from "@/domain/artists/growth";
import { getArtistWallet, ledgerIsBalanced } from "@/domain/money/ledger";
import { payoutMinCents, requestPayout, markPayoutPaid } from "@/domain/payouts/service";
import { createSeriesDraft } from "@/domain/series-workflow";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
  await db.coinPack.create({ data: { id: "p10000", priceKz: 10000, coins: 1000, sortOrder: 1 } });
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

async function richFan() {
  const fan = await makeUser(db);
  const admin = await makeUser(db, "ADMIN");
  const p = await createCoinPaymentRequest(db, { userId: fan.id, packId: "p10000", method: "MULTICAIXA_EXPRESS", payerPhone: "+244923000000", transactionRef: `R${Math.random().toString(36).slice(2, 12)}`, proofHash: randomHash(), storeProof: async () => "k" });
  await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
  return { fan, admin }; // 1.000 moedas, 10 Kz cada
}

describe("Artistas Fundadores", () => {
  it("os primeiros N recebem número; Fundador ganha 70% nos primeiros meses e as séries começam em Normal", async () => {
    await setSetting(db, "foundersLimit", "1");
    const { artist, series, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const n = await db.$transaction((tx) => assignFounder(tx, artist.id));
    expect(n).toBe(1);
    const other = await makeArtistWithSeries(db);
    expect(await db.$transaction((tx) => assignFounder(tx, other.artist.id))).toBeNull();
    expect((await foundersLeft(db)).left).toBe(0);
    const { fan } = await richFan();
    const s = await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id });
    expect(s.valueCents).toBe(20000);
    expect(s.artistCents).toBe(14000); // 70%
    // depois dos 3 meses volta à parte normal
    await db.artistProfile.update({ where: { id: artist.id }, data: { createdAt: new Date(Date.now() - 100 * 86400000) } });
    const s2 = await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[2].id });
    expect(s2.artistCents).toBe(10000);
    const draft = await createSeriesDraft(db, artist.id, { title: "Nova do fundador", synopsis: "x", category: "DRAMA" });
    expect(draft.tier).toBe("NORMAL");
    const draft2 = await createSeriesDraft(db, other.artist.id, { title: "Nova normal", synopsis: "x", category: "DRAMA" });
    expect(draft2.tier).toBe("ENTRY");
    void series;
    await setSetting(db, "foundersLimit", "20");
  });
});

describe("1.ª venda, convite e marcos", () => {
  it("primeira venda avisa; quem convidou ganha o bónus uma vez; marcos pagam uma vez, da parte da plataforma", async () => {
    await setSetting(db, "milestone1Unlocks", "2");
    await setSetting(db, "milestone2Unlocks", "4");
    await setSetting(db, "milestone3Unlocks", "6");
    const inviter = await makeArtistWithSeries(db);
    const { artist, series, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1, episodes: 8 });
    await db.artistProfile.update({ where: { id: artist.id }, data: { invitedByArtistId: inviter.artist.id, createdAt: new Date(Date.now() - 400 * 86400000) } });
    const before = (await getArtistWallet(db, inviter.artist.id)).availableCents;
    const { fan } = await richFan();
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id });
    expect(await db.notification.count({ where: { userId: artist.userId, body: { contains: "primeiro fã" } } })).toBe(1);
    expect((await getArtistWallet(db, inviter.artist.id)).availableCents - before).toBe(200000); // 2.000 Kz
    // não há "+X Kz" a cada desbloqueio
    expect(await db.notification.count({ where: { userId: artist.userId, body: { startsWith: "+" } } })).toBe(0);
    const w0 = (await getArtistWallet(db, artist.id)).availableCents;
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[2].id }); // 2 desbloqueios → marco 1
    const w1 = (await getArtistWallet(db, artist.id)).availableCents;
    expect(w1 - w0).toBe(10000 + 250000);
    await unlockSeasonWithCoins(db, { userId: fan.id, seriesId: series.id }); // +5 → 7: marcos 2 e 3
    const ms = await db.seriesMilestone.findMany({ where: { seriesId: series.id, kind: "UNLOCKS" } });
    expect(ms.map((m) => m.threshold).sort((a, b) => a - b)).toEqual([2, 4, 6]);
    expect((await db.series.findUniqueOrThrow({ where: { id: series.id } })).crownedAt).not.toBeNull();
    // segunda venda do convidado não paga outra vez o convite
    expect((await getArtistWallet(db, inviter.artist.id)).availableCents - before).toBe(200000);
    // resumo diário: uma vez por dia
    expect(await sendDailySummaries(db)).toBeGreaterThan(0);
    expect(await sendDailySummaries(db)).toBe(0);
    expect(await db.notification.count({ where: { userId: artist.userId, body: { startsWith: "Hoje ganhaste" } } })).toBe(1);
  });
});

describe("Levantamentos", () => {
  it("1.º levantamento a partir de 1.000 Kz; os seguintes a partir de 5.000 Kz; contador público", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1, episodes: 8 });
    await db.payoutAccount.create({ data: { artistId: artist.id, method: "MULTICAIXA_EXPRESS", holderName: "X", mcxPhone: "+244923000000" } });
    await db.artistProfile.update({ where: { id: artist.id }, data: { verifiedAt: new Date() } });
    const { fan, admin } = await richFan();
    for (const e of episodes.slice(1)) await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: e.id });
    expect(await payoutMinCents(db, artist.id)).toBe(100000);
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 50000 })).rejects.toThrow(/mínimo/);
    const p = await requestPayout(db, { artistId: artist.id, amountCents: 100000 });
    expect(await payoutMinCents(db, artist.id)).toBe(500000);
    const paidBefore = await totalPaidToArtists(db);
    await markPayoutPaid(db, { payoutId: p.id, adminId: admin.id });
    expect((await totalPaidToArtists(db)) - paidBefore).toBe(100000);
  });
});
