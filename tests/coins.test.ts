import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import { confirmPayment, createCoinPaymentRequest, rejectPayment, reversePayment } from "@/domain/payments/service";
import {
  coinBalance,
  defaultEpisodePriceCoins,
  episodePriceCoins,
  packBonusPercent,
  sendGiftWithCoins,
  setSetting,
  unlockEpisodeWithCoins,
} from "@/domain/coins/service";
import { balance, getArtistWallet, ledgerIsBalanced } from "@/domain/money/ledger";
import { COINS_OUTSTANDING, PLATFORM_REVENUE } from "@/domain/money/accounts";
import { episodeStates } from "@/domain/access";
import { requestPayout } from "@/domain/payouts/service";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
  // A BD de teste é criada sem os dados da migração: recria os valores por defeito
  await db.coinPack.createMany({
    data: [
      { id: "p1000", priceKz: 1000, coins: 100, sortOrder: 1 },
      { id: "p2000", priceKz: 2000, coins: 220, sortOrder: 2 },
      { id: "p5000", priceKz: 5000, coins: 575, sortOrder: 3 },
      { id: "p10000", priceKz: 10000, coins: 1200, sortOrder: 4 },
      { id: "off", priceKz: 500, coins: 50, active: false },
    ],
  });
  await db.giftType.createMany({
    data: [
      { code: "MIMO", label: "Mimo", emoji: "💝", priceCoins: 10 },
      { code: "COROA", label: "Coroa", emoji: "👑", priceCoins: 500 },
    ],
  });
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

const proof = () => ({
  method: "MULTICAIXA_EXPRESS" as const,
  payerPhone: "+244923000000",
  transactionRef: `R${Math.random().toString(36).slice(2, 12)}`,
  proofHash: randomHash(),
  storeProof: async () => "k",
});

async function buyCoins(userId: string, packId: string, opts: { feeCents?: number } = {}) {
  const admin = await makeUser(db, "ADMIN");
  const p = await createCoinPaymentRequest(db, { userId, packId, ...proof() });
  await confirmPayment(db, { paymentId: p.id, adminId: admin.id, feeCents: opts.feeCents });
  return { payment: p, admin };
}

describe("Comprar moedas", () => {
  it("as moedas só entram depois de o admin confirmar, uma única vez, e ficam como 'por gastar'", async () => {
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const outBefore = await balance(db, COINS_OUTSTANDING);
    const revBefore = await balance(db, PLATFORM_REVENUE);
    const p = await createCoinPaymentRequest(db, { userId: fan.id, packId: "p2000", ...proof() });
    expect(p.amountCents).toBe(200000);
    expect(p.coins).toBe(220);
    expect(await coinBalance(db, fan.id)).toBe(0);
    await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    expect(await coinBalance(db, fan.id)).toBe(220);
    await expect(confirmPayment(db, { paymentId: p.id, adminId: admin.id })).rejects.toThrow();
    expect(await coinBalance(db, fan.id)).toBe(220);
    expect(await balance(db, COINS_OUTSTANDING)).toBe(outBefore + 200000);
    expect(await balance(db, PLATFORM_REVENUE)).toBe(revBefore); // moedas não gastas não são receita
  });

  it("rejeitar não dá moedas; pacote inativo e comprovativo repetido são recusados", async () => {
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const pr = proof();
    const p = await createCoinPaymentRequest(db, { userId: fan.id, packId: "p1000", ...pr });
    await rejectPayment(db, { paymentId: p.id, adminId: admin.id, reason: "Valor errado" });
    expect(await coinBalance(db, fan.id)).toBe(0);
    await expect(createCoinPaymentRequest(db, { userId: fan.id, packId: "off", ...proof() })).rejects.toThrow(/não está disponível/);
    await expect(createCoinPaymentRequest(db, { userId: fan.id, packId: "p1000", ...proof(), proofHash: pr.proofHash })).rejects.toThrow(/já foi usado/);
  });

  it("bónus dos pacotes", () => {
    const base = { priceKz: 1000, coins: 100 };
    expect(packBonusPercent({ priceKz: 2000, coins: 220 }, base)).toBe(10);
    expect(packBonusPercent({ priceKz: 5000, coins: 575 }, base)).toBe(15);
    expect(packBonusPercent({ priceKz: 10000, coins: 1200 }, base)).toBe(20);
    expect(packBonusPercent(base, base)).toBe(0);
  });
});

describe("Desbloquear episódios com moedas", () => {
  it("preço por defeito 20 moedas, editável, com exceção por série", async () => {
    const { series } = await makeArtistWithSeries(db);
    expect(await defaultEpisodePriceCoins(db)).toBe(20);
    await setSetting(db, "episodePriceCoins", "25");
    expect(await episodePriceCoins(db, series)).toBe(25);
    expect(await episodePriceCoins(db, { priceCoins: 40 })).toBe(40);
    await setSetting(db, "episodePriceCoins", "20");
  });

  it("artista ganha 50% do VALOR REAL das moedas gastas; o episódio fica desbloqueado para sempre", async () => {
    const fan = await makeUser(db);
    const { artist, series, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 3 });
    await buyCoins(fan.id, "p1000"); // 100 moedas por 1.000 Kz → 10 Kz por moeda
    const revBefore = await balance(db, PLATFORM_REVENUE);
    const spend = await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[3].id });
    expect(spend.coins).toBe(20);
    expect(spend.valueCents).toBe(20000); // 20 moedas × 10 Kz
    expect(spend.artistCents).toBe(10000); // 100 Kz para o artista
    expect(await coinBalance(db, fan.id)).toBe(80);
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(10000);
    expect(await balance(db, PLATFORM_REVENUE)).toBe(revBefore + 10000);
    const states = await episodeStates(db, fan.id, series, episodes);
    expect(states[episodes[3].id]).toBe("unlocked");
    await expect(unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[3].id })).rejects.toThrow(/Já desbloqueaste/);
    expect(await coinBalance(db, fan.id)).toBe(80);
  });

  it("com bónus, a moeda vale menos e o artista recebe 50% desse valor real", async () => {
    const fan = await makeUser(db);
    const { artist, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 3 });
    await buyCoins(fan.id, "p10000"); // 1.200 moedas por 10.000 Kz → 8,33 Kz por moeda
    const spend = await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[3].id });
    expect(spend.valueCents).toBe(Math.floor((1000000 * 20) / 1200)); // 16 666 cêntimos
    expect(spend.artistCents).toBe(Math.floor(spend.valueCents / 2));
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(spend.artistCents);
  });

  it("a comissão do pagamento é descontada do valor das moedas", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 3 });
    await buyCoins(fan.id, "p1000", { feeCents: 5000 }); // 950 Kz líquidos por 100 moedas
    const spend = await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[3].id });
    expect(spend.valueCents).toBe(19000);
    expect(spend.artistCents).toBe(9500);
  });

  it("usa primeiro as moedas mais antigas e não perde cêntimos ao gastar tudo", async () => {
    const fan = await makeUser(db);
    await buyCoins(fan.id, "p10000"); // 1200 moedas, 1 000 000 cêntimos
    const { artist } = await makeArtistWithSeries(db);
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const s = await sendGiftWithCoins(db, { userId: fan.id, artistId: artist.id, giftCode: "MIMO" }); // 10 moedas
      total += s.valueCents;
    }
    expect(await coinBalance(db, fan.id)).toBe(600);
    for (let i = 0; i < 60; i++) total += (await sendGiftWithCoins(db, { userId: fan.id, artistId: artist.id, giftCode: "MIMO" })).valueCents;
    expect(await coinBalance(db, fan.id)).toBe(0);
    expect(total).toBe(1000000); // soma exata do valor pago
  });

  it("sem moedas suficientes, recusa e não cobra nada", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 3 });
    await expect(unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[3].id })).rejects.toThrow(/Precisas de 20 moedas/);
    await expect(unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[0].id })).rejects.toThrow(/grátis/);
  });

  it("dois cliques ao mesmo tempo só cobram uma vez", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 3 });
    await buyCoins(fan.id, "p1000");
    const r = await Promise.allSettled([
      unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[3].id }),
      unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[3].id }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await coinBalance(db, fan.id)).toBe(80);
  });

  it("gastos simultâneos em episódios diferentes nunca passam o saldo", async () => {
    const fan = await makeUser(db);
    const a = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await buyCoins(fan.id, "p1000"); // 100 moedas = 5 episódios
    const r = await Promise.allSettled(
      [1, 2, 3, 1, 2, 3].map((i, k) =>
        k < 3 ? unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: a.episodes[i].id }) : sendGiftWithCoins(db, { userId: fan.id, artistId: a.artist.id, giftCode: "MIMO" }),
      ),
    );
    expect(r.every((x) => x.status === "fulfilled")).toBe(true);
    expect(await coinBalance(db, fan.id)).toBe(100 - 60 - 30);
  });
});

describe("Presentes com moedas", () => {
  it("50% do valor real para o artista; inválido e a si próprio recusados", async () => {
    const fan = await makeUser(db);
    const { artist, user } = await makeArtistWithSeries(db);
    await buyCoins(fan.id, "p1000");
    const s = await sendGiftWithCoins(db, { userId: fan.id, artistId: artist.id, giftCode: "MIMO" });
    expect(s.valueCents).toBe(10000);
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(5000);
    await expect(sendGiftWithCoins(db, { userId: fan.id, artistId: artist.id, giftCode: "OURO" })).rejects.toThrow(/inválido/);
    await expect(sendGiftWithCoins(db, { userId: user.id, artistId: artist.id, giftCode: "MIMO" })).rejects.toThrow(/ti próprio/);
    await expect(sendGiftWithCoins(db, { userId: fan.id, artistId: artist.id, giftCode: "COROA" })).rejects.toThrow(/Precisas de 500/);
  });
});

describe("Anular uma compra de moedas", () => {
  it("retira as moedas não gastas, volta a bloquear os episódios e retira ao artista a parte dele", async () => {
    const fan = await makeUser(db);
    const { artist, series, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const { payment, admin } = await buyCoins(fan.id, "p1000");
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id });
    await sendGiftWithCoins(db, { userId: fan.id, artistId: artist.id, giftCode: "MIMO" });
    expect(await coinBalance(db, fan.id)).toBe(70);
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(15000);
    const outBefore = await balance(db, COINS_OUTSTANDING);

    await reversePayment(db, { paymentId: payment.id, adminId: admin.id, reason: "Comprovativo falso" });
    expect(await coinBalance(db, fan.id)).toBe(0);
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(0);
    expect((await episodeStates(db, fan.id, series, episodes))[episodes[1].id]).toBe("locked");
    expect(await balance(db, COINS_OUTSTANDING)).toBe(outBefore - 70000); // sai o que restava por gastar
  });

  it("um gasto que misturou duas compras devolve as moedas da compra boa", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const bad = await buyCoins(fan.id, "p1000"); // 100
    // gasta 90 da compra má
    const a = await makeArtistWithSeries(db);
    for (let i = 0; i < 9; i++) await sendGiftWithCoins(db, { userId: fan.id, artistId: a.artist.id, giftCode: "MIMO" });
    await buyCoins(fan.id, "p1000"); // compra boa: +100 → saldo 110
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id }); // 10 da má + 10 da boa
    expect(await coinBalance(db, fan.id)).toBe(90);
    await reversePayment(db, { paymentId: bad.payment.id, adminId: bad.admin.id, reason: "falso" });
    expect(await coinBalance(db, fan.id)).toBe(100); // a compra boa fica inteira
    expect((await getArtistWallet(db, a.artist.id)).availableCents).toBe(0);
  });

  it("se o artista já levantou, a carteira fica negativa e os levantamentos param", async () => {
    const { artist } = await makeArtistWithSeries(db);
    await db.payoutAccount.create({ data: { artistId: artist.id, holderName: "Nome Completo", method: "MULTICAIXA_EXPRESS", mcxPhone: "+244923111111" } });
    const badFan = await makeUser(db);
    const goodFan = await makeUser(db);
    const bad = await buyCoins(badFan.id, "p10000");
    await buyCoins(goodFan.id, "p10000");
    await sendGiftWithCoins(db, { userId: badFan.id, artistId: artist.id, giftCode: "COROA" });
    await sendGiftWithCoins(db, { userId: badFan.id, artistId: artist.id, giftCode: "COROA" });
    await sendGiftWithCoins(db, { userId: goodFan.id, artistId: artist.id, giftCode: "COROA" });
    const before = await getArtistWallet(db, artist.id);
    expect(before.availableCents).toBeGreaterThan(500000);
    await requestPayout(db, { artistId: artist.id, amountCents: 500000 });
    await reversePayment(db, { paymentId: bad.payment.id, adminId: bad.admin.id, reason: "falso" });
    const after = await getArtistWallet(db, artist.id);
    expect(after.availableCents).toBeLessThan(0);
    await expect(requestPayout(db, { artistId: artist.id, amountCents: 500000 })).rejects.toThrow(/insuficiente/);
  });
});
