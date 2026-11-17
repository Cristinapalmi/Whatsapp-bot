import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import {
  confirmPayment,
  createGiftPaymentRequest,
  createPassPaymentRequest,
  reversePayment,
} from "@/domain/payments/service";
import { closeEndedWeeks, closePassWeek } from "@/domain/payments/pass";
import { balance, getArtistWallet, ledgerIsBalanced } from "@/domain/money/ledger";
import { PLATFORM_REVENUE, passPool } from "@/domain/money/accounts";
import { nextWeekKey, weekDays, weekKey, weekRange } from "@/domain/money/weeks";
import { episodeStates } from "@/domain/access";
import { awardCompletionPoints, pointsBalance, redeemEpisodeWithPoints, topFans } from "@/domain/points";
import { monthlyRanking } from "@/domain/ranking";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
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

// Semanas fixas para os testes (no passado, para poderem ser fechadas)
const W1 = "2026-W10";
const W2 = nextWeekKey(W1);
const inWeek = (w: string, hours = 30) => new Date(weekRange(w).start.getTime() + hours * 3600_000);
const afterWeek = (w: string) => new Date(weekRange(w).end.getTime() + 3600_000);

async function buyPass(userId: string, adminId: string, now: Date) {
  const p = await createPassPaymentRequest(db, { userId, ...proof() });
  await confirmPayment(db, { paymentId: p.id, adminId, now });
  return p;
}
async function watchViaPass(userId: string, episodeId: string, artistId: string, week: string, seconds: number) {
  await db.watchLog.create({ data: { day: weekDays(week).from, userId, episodeId, artistId, seconds, viaPass: true } });
}

describe("Passe semanal", () => {
  it("confirmar: 150 Kz plataforma + 150 Kz no fundo da semana, passe de 7 dias que dá acesso", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    const { series, episodes } = await makeArtistWithSeries(db);
    const revBefore = await balance(db, PLATFORM_REVENUE);
    const now = inWeek(W1);
    const p = await buyPass(fan.id, admin.id, now);
    expect(p.amountCents).toBe(30000);
    expect(await balance(db, PLATFORM_REVENUE)).toBe(revBefore + 15000);
    expect(await balance(db, passPool(weekKey(now)))).toBe(15000);
    const pass = await db.weeklyPass.findFirstOrThrow({ where: { userId: fan.id } });
    expect(pass.endsAt.getTime() - pass.startsAt.getTime()).toBe(7 * 86400000);
    const states = await episodeStates(db, fan.id, series, episodes);
    // dentro do período do passe? (o teste corre "agora", depois do passe) — verificar pelo intervalo
    expect(states[episodes[3].id]).toBe("locked"); // o passe de março já expirou
  });

  it("segundo passe prolonga o primeiro", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    await buyPass(fan.id, admin.id, inWeek(W1));
    await buyPass(fan.id, admin.id, inWeek(W1, 40));
    const passes = await db.weeklyPass.findMany({ where: { userId: fan.id }, orderBy: { startsAt: "asc" } });
    expect(passes[1].startsAt.getTime()).toBe(passes[0].endsAt.getTime());
  });

  it("passe ativo desbloqueia os episódios pagos", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    const { series, episodes } = await makeArtistWithSeries(db);
    await buyPass(fan.id, admin.id, new Date());
    const states = await episodeStates(db, fan.id, series, episodes);
    expect(states[episodes[3].id]).toBe("unlocked");
  });

  it("fecho semanal divide o fundo pelo tempo visto com passe, e não pode repetir", async () => {
    const admin = await makeUser(db, "ADMIN");
    // Fundo das semanas W1 e anteriores pode ter valores dos testes acima: fechamos tudo o que está aberto até W1
    const a = await makeArtistWithSeries(db);
    const b = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    await watchViaPass(fan.id, a.episodes[3].id, a.artist.id, W1, 1200);
    await watchViaPass(fan.id, b.episodes[3].id, b.artist.id, W1, 600);
    await expect(closePassWeek(db, { week: W1, adminId: admin.id, now: inWeek(W1, 100) })).rejects.toThrow(/ainda não terminou/);

    const pool = await balance(db, passPool(W1));
    const res = await closePassWeek(db, { week: W1, adminId: admin.id, now: afterWeek(W1) });
    expect(res.pool).toBe(pool);
    // Outros artistas destes testes não viram nada em W1 → só A e B recebem
    expect(res.allocations[a.artist.id]).toBe(Math.floor((pool * 1200) / 1800));
    expect(res.allocations[b.artist.id]).toBe(Math.floor((pool * 600) / 1800));
    expect((await getArtistWallet(db, a.artist.id)).availableCents).toBe(res.allocations[a.artist.id]);
    expect(await balance(db, passPool(W1))).toBe(0);
    await expect(closePassWeek(db, { week: W1, adminId: admin.id, now: afterWeek(W1) })).rejects.toThrow(/já foi fechada/);
  });

  it("semana sem visualizações: o fundo passa para a semana seguinte", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    const c = await makeArtistWithSeries(db);
    await buyPass(fan.id, admin.id, inWeek(W2)); // fundo W2 = 150 Kz, ninguém vê em W2
    const W3 = nextWeekKey(W2);
    const r2 = await closePassWeek(db, { week: W2, adminId: admin.id, now: afterWeek(W2) });
    expect(r2.rolloverCents).toBe(15000);
    expect(await balance(db, passPool(W3))).toBe(15000);
    // Em W3, C vê com passe → recebe o fundo que passou
    await watchViaPass(fan.id, c.episodes[3].id, c.artist.id, W3, 300);
    const results = await closeEndedWeeks(db, { adminId: admin.id, now: afterWeek(W3) });
    expect(results.map((r) => r.week)).toContain(W3);
    expect((await getArtistWallet(db, c.artist.id)).availableCents).toBe(15000);
  });

  it("as semanas fecham por ordem", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    const W5 = "2026-W20";
    const W6 = nextWeekKey(W5);
    await buyPass(fan.id, admin.id, inWeek(W5));
    await buyPass(fan.id, admin.id, inWeek(W6));
    await expect(closePassWeek(db, { week: W6, adminId: admin.id, now: afterWeek(W6) })).rejects.toThrow(/Fecha primeiro/);
    await closeEndedWeeks(db, { adminId: admin.id, now: afterWeek(W6) });
  });

  it("anular um passe depois do fecho: a parte dos artistas sai do fundo da semana atual e o passe é revogado", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    const W8 = "2026-W30";
    const p = await buyPass(fan.id, admin.id, inWeek(W8));
    const d = await makeArtistWithSeries(db);
    await watchViaPass(fan.id, d.episodes[3].id, d.artist.id, W8, 100);
    await closeEndedWeeks(db, { adminId: admin.id, now: afterWeek(W8) });
    const paid = (await getArtistWallet(db, d.artist.id)).availableCents;
    expect(paid).toBeGreaterThan(0);
    const now = inWeek("2026-W32");
    await reversePayment(db, { paymentId: p.id, adminId: admin.id, reason: "Transferência falsa", now });
    expect(await balance(db, passPool("2026-W32"))).toBe(-15000); // a próxima distribuição fica reduzida
    expect((await getArtistWallet(db, d.artist.id)).availableCents).toBe(paid); // o artista não perde o que já recebeu
    expect((await db.weeklyPass.findFirstOrThrow({ where: { paymentRequestId: p.id } })).revokedAt).not.toBeNull();
    // um fundo negativo nunca é distribuído: passa para a semana seguinte
    const r = await closePassWeek(db, { week: "2026-W32", adminId: admin.id, now: afterWeek("2026-W32") });
    expect(r.allocations).toEqual({});
    expect(await balance(db, passPool(nextWeekKey("2026-W32")))).toBe(-15000);
  });
});

describe("Presentes", () => {
  it("Cuca 50 Kz → 25 Kz para o artista; Grade 500 Kz → 250 Kz", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    const { artist } = await makeArtistWithSeries(db);
    for (const giftId of ["CUCA", "GRADE"]) {
      const p = await createGiftPaymentRequest(db, { userId: fan.id, artistId: artist.id, giftId, ...proof() });
      await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    }
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(2500 + 25000);
  });

  it("presente inválido ou a si próprio é recusado", async () => {
    const { artist, user } = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    await expect(createGiftPaymentRequest(db, { userId: fan.id, artistId: artist.id, giftId: "OURO", ...proof() })).rejects.toThrow(/inválido/);
    await expect(createGiftPaymentRequest(db, { userId: user.id, artistId: artist.id, giftId: "CUCA", ...proof() })).rejects.toThrow(/ti próprio/);
  });
});

describe("Pontos de fã (sem valor em dinheiro)", () => {
  it("+10 por episódio visto até ao fim, só uma vez", async () => {
    const fan = await makeUser(db);
    const { artist, episodes } = await makeArtistWithSeries(db);
    expect(await awardCompletionPoints(db, fan.id, episodes[0].id, artist.id)).toBe(true);
    expect(await awardCompletionPoints(db, fan.id, episodes[0].id, artist.id)).toBe(false);
    expect(await pointsBalance(db, fan.id)).toBe(10);
  });

  it("100 pontos = 1 episódio; não gera pagamento ao artista nem mexe no livro-razão", async () => {
    const fan = await makeUser(db);
    const { artist, episodes, series } = await makeArtistWithSeries(db);
    const other = await makeArtistWithSeries(db);
    await expect(redeemEpisodeWithPoints(db, { userId: fan.id, episodeId: episodes[3].id })).rejects.toThrow(/Precisas de 100/);
    for (const ep of [...episodes, ...other.episodes].slice(0, 8)) await awardCompletionPoints(db, fan.id, ep.id, ep.seriesId === series.id ? artist.id : other.artist.id);
    await db.pointsTransaction.create({ data: { userId: fan.id, delta: 20, reason: "ADMIN_ADJUST" } });
    expect(await pointsBalance(db, fan.id)).toBe(100);
    const linesBefore = await db.ledgerLine.count();
    const ent = await redeemEpisodeWithPoints(db, { userId: fan.id, episodeId: episodes[3].id });
    expect(ent.source).toBe("POINTS");
    expect(await pointsBalance(db, fan.id)).toBe(0);
    expect(await db.ledgerLine.count()).toBe(linesBefore);
    expect((await getArtistWallet(db, artist.id)).availableCents).toBe(0);
  });

  it("não se gastam os mesmos pontos duas vezes em simultâneo", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await db.pointsTransaction.create({ data: { userId: fan.id, delta: 100, reason: "ADMIN_ADJUST" } });
    const r = await Promise.allSettled([
      redeemEpisodeWithPoints(db, { userId: fan.id, episodeId: episodes[1].id }),
      redeemEpisodeWithPoints(db, { userId: fan.id, episodeId: episodes[2].id }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await pointsBalance(db, fan.id)).toBe(0);
  });

  it("Fã n.º 1 = quem tem mais pontos a ver esse artista", async () => {
    const { artist, episodes } = await makeArtistWithSeries(db);
    const f1 = await db.user.create({ data: { name: "Joana Manuel", phone: "+244911000001", passwordHash: "x", birthDate: new Date("2000-01-01") } });
    const f2 = await makeUser(db);
    for (const ep of episodes) await awardCompletionPoints(db, f1.id, ep.id, artist.id);
    await awardCompletionPoints(db, f2.id, episodes[0].id, artist.id);
    const fans = await topFans(db, artist.id);
    expect(fans[0]).toMatchObject({ userId: f1.id, displayName: "Joana M.", points: 40 });
  });
});

describe("Disputa dos artistas", () => {
  it("ranking mensal por visualizações e receita", async () => {
    const admin = await makeUser(db, "ADMIN");
    const fan = await makeUser(db);
    const a = await makeArtistWithSeries(db, { freeEpisodes: 0 });
    const today = new Date();
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    await db.watchLog.create({ data: { day, userId: fan.id, episodeId: a.episodes[0].id, artistId: a.artist.id, seconds: 600 } });
    const p = await createGiftPaymentRequest(db, { userId: fan.id, artistId: a.artist.id, giftId: "CANDONGA", ...proof() });
    await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    const rows = await monthlyRanking(db);
    const row = rows.find((r) => r.artistId === a.artist.id)!;
    expect(row.views).toBe(1);
    expect(row.minutes).toBe(10);
    expect(row.earnedCents).toBe(10000);
  });
});
