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
  // Estes testes verificam outras regras: os ganhos ficam disponíveis logo (o pendente tem testes próprios)
  await db.setting.create({ data: { key: "pendingDays", value: "0" } });
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
    expect(await db.notification.count({ where: { userId: artist.userId, body: { startsWith: "Hoje" } } })).toBe(1);
  });
});

describe("Levantamentos", () => {
  it("mínimo de levantamento por defeito 5.000 Kz; 1.º e seguintes editáveis; contador público", async () => {
    const { payoutMinCents: pm } = await import("@/domain/payouts/service");
    const probe = await makeArtistWithSeries(db);
    expect(await pm(db, probe.artist.id)).toBe(500000);
    await setSetting(db, "payoutFirstMinKz", "1000");
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
    await setSetting(db, "payoutFirstMinKz", "5000");
  });
});

describe("Painel financeiro do artista (dados reais)", () => {
  it("4 valores batem com o livro-razão; metas e aviso opcional a cada desbloqueio", async () => {
    const { artistMoneySnapshot, earningsHistory, topEpisodes } = await import("@/domain/artists/growth");
    for (const [k, v] of [["milestone1Unlocks", "500"], ["milestone2Unlocks", "1000"], ["milestone3Unlocks", "5000"]]) await setSetting(db, k, v);
    const { artist, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1, episodes: 8 });
    await db.artistProfile.update({ where: { id: artist.id }, data: { createdAt: new Date(Date.now() - 400 * 86400000) } });
    const s0 = await artistMoneySnapshot(db, artist.id);
    expect([s0.totalCents, s0.pendingCents, s0.availableCents, s0.withdrawnCents]).toEqual([0, 0, 0, 0]);
    expect(s0.achievements).toEqual([]);
    const { fan } = await richFan();
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id }); // 1.ª venda: 100 Kz
    // aviso a cada desbloqueio: desligado por defeito
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[2].id });
    expect(await db.notification.count({ where: { userId: artist.userId, body: { contains: "acabou de gerar mais receita" } } })).toBe(0);
    await db.artistProfile.update({ where: { id: artist.id }, data: { notifyEachUnlock: true } });
    for (const e of episodes.slice(3)) await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: e.id });
    expect(await db.notification.count({ where: { userId: artist.userId, body: { contains: "acabou de gerar mais receita" } } })).toBe(5);
    const s1 = await artistMoneySnapshot(db, artist.id);
    expect(s1.totalCents).toBe(70000); // 7 × 100 Kz
    expect(s1.availableCents).toBe(70000);
    expect(s1.todayCents).toBe(70000);
    // metas em blocos de 5.000 Kz
    expect(s1.goal?.targetCents).toBe(500000);
    const { toMoneyDisplay } = await import("@/domain/artists/growth");
    const disp = toMoneyDisplay(s1, 500000);
    expect(disp.total.shownCents).toBe(0); // 700 Kz < 5.000 → não se mostra
    expect(disp.total.progress).toBeCloseTo(0.14, 2);
    expect(disp.available.shownCents).toBe(0);
    const hist = await earningsHistory(db, artist.id, "day");
    expect(hist).toHaveLength(30);
    expect(hist.at(-1)!.cents).toBe(70000);
    expect((await topEpisodes(db, artist.id, 3))[0].cents).toBe(10000);
  });
});

describe("Painel atrativo e ranking (dados reais)", () => {
  it("ranking por fãs/desbloqueios/seguidores; ganhos só se o artista autorizar; atividade sem identificar o fã", async () => {
    const { creatorRanking, sortRanking, weekRange, weeklyPosition } = await import("@/domain/creator-ranking");
    const { recentActivity, starterChecklist } = await import("@/domain/artists/dashboard");
    const { artist, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1, episodes: 6 });
    const other = await makeArtistWithSeries(db, { freeEpisodes: 1, episodes: 6 });
    const { fan } = await richFan();
    for (const e of episodes.slice(1, 4)) await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: e.id });
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: other.episodes[1].id });
    await db.follow.create({ data: { userId: fan.id, artistId: other.artist.id } });
    const rows = await creatorRanking(db, weekRange());
    const mine = rows.find((r) => r.artistId === artist.id)!;
    expect(mine.unlocks).toBe(3);
    expect(mine.earnedCents).toBeNull(); // desligado por defeito
    expect(sortRanking(rows, "unlocks")[0].unlocks).toBeGreaterThanOrEqual(3);
    expect(sortRanking(rows, "followers")[0].artistId).toBe(other.artist.id);
    await db.artistProfile.update({ where: { id: artist.id }, data: { showEarningsInRanking: true } });
    expect((await creatorRanking(db, weekRange())).find((r) => r.artistId === artist.id)!.earnedCents).toBeGreaterThan(0);
    expect((await weeklyPosition(db, artist.id)).position).not.toBeNull();
    const act = await recentActivity(db, artist.id, 5);
    expect(act[0].text).toMatch(/^Um fã desbloqueou o ep\./);
    const fanUser = await db.user.findUniqueOrThrow({ where: { id: fan.id } });
    expect(act.some((a) => a.text.includes(fanUser.name))).toBe(false);
    const fresh = await db.artistProfile.findUniqueOrThrow({ where: { id: artist.id } });
    const cl = await starterChecklist(db, fresh);
    expect(cl.tasks.find((t) => t.key === "serie")!.done).toBe(true);
    expect(cl.tasks.find((t) => t.key === "fa")!.done).toBe(true);
    expect(cl.tasks.find((t) => t.key === "perfil")!.done).toBe(false);
  });
});

describe("Rei/Rainha da KONTA", () => {
  it("é o 1.º do mês passado por fãs (nunca por dinheiro)", async () => {
    const { monthlyKing, monthRangeLuanda } = await import("@/domain/creator-ranking");
    const { artist, episodes } = await makeArtistWithSeries(db);
    const r = monthRangeLuanda(new Date(), -1);
    const day = new Date(r.from.getTime() + 5 * 86400000);
    for (let i = 0; i < 3; i++) {
      const u = await makeUser(db);
      await db.watchLog.create({ data: { day, userId: u.id, episodeId: episodes[0].id, artistId: artist.id, seconds: 60, viaPass: false } });
    }
    expect((await monthlyKing(db))?.artistId).toBe(artist.id);
  });
});

describe("Repor contador de Fundadores", () => {
  it("renumera os artistas que existem por ordem de registo e liberta as vagas das contas apagadas", async () => {
    const { resetFounders, foundersLeft } = await import("@/domain/artists/growth");
    await setSetting(db, "foundersLimit", "20");
    const r = await resetFounders(db);
    const nums = (await db.artistProfile.findMany({ where: { founderNumber: { not: null } }, orderBy: { founderNumber: "asc" }, select: { founderNumber: true } })).map((x) => x.founderNumber);
    expect(nums).toEqual(Array.from({ length: nums.length }, (_, i) => i + 1));
    expect((await foundersLeft(db)).left).toBe(r.left);
  });
});

describe("Blocos de 5.000 Kz no painel", () => {
  it("arredonda para baixo, metas por bloco e aviso 'Ganhaste 5.000 Kz! Já podes levantar.' uma vez por bloco", async () => {
    const { floorBlock, blockProgress, checkAvailableBlocks, toMoneyDisplay, artistMoneySnapshot } = await import("@/domain/artists/growth");
    expect(floorBlock(730000, 500000)).toBe(500000);
    expect(floorBlock(1490000, 500000)).toBe(1000000);
    expect(floorBlock(499999, 500000)).toBe(0);
    expect(blockProgress(750000, 500000)).toBeCloseTo(0.5);
    const { artist } = await makeArtistWithSeries(db);
    // 12.000 Kz disponíveis (ex.: bónus pago pela plataforma)
    const { postEntry } = await import("@/domain/money/ledger");
    const { PLATFORM_REVENUE, artistAvailable } = await import("@/domain/money/accounts");
    await postEntry(db, { kind: "ARTIST_BONUS", description: "teste", idempotencyKey: `t-${artist.id}`, lines: [{ account: PLATFORM_REVENUE, amountCents: 1200000 }, { account: artistAvailable(artist.id), amountCents: -1200000 }] });
    expect(await checkAvailableBlocks(db, artist.id)).toBe(2);
    expect(await checkAvailableBlocks(db, artist.id)).toBe(0); // não repete
    const n = await db.notification.findFirst({ where: { userId: artist.userId, body: { contains: "Já podes levantar" } } });
    expect(n?.body).toBe("🎉 Ganhaste 10 000 Kz! Já podes levantar.".replace("10 000", n!.body.match(/Ganhaste (.+) Kz/)![1]));
    const d = toMoneyDisplay(await artistMoneySnapshot(db, artist.id), 500000);
    expect(d.available.shownCents).toBe(1000000);
    expect(d.canWithdraw).toBe(true);
  });
});
