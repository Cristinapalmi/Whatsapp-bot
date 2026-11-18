import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, resetTestDb } from "./helpers";
import { adOfferStatus, completeAdView, distributeAdPool, monthKeyLuanda, registerAdRevenue, startAdView } from "@/domain/ads/service";
import { balance, getArtistWallet, ledgerIsBalanced } from "@/domain/money/ledger";
import { PLATFORM_REVENUE, adPool } from "@/domain/money/accounts";
import { episodeStates } from "@/domain/access";
import { setSetting } from "@/domain/coins/service";

let db: PrismaClient;
let adId: string;
beforeAll(async () => {
  db = await resetTestDb();
  adId = (await db.ad.create({ data: { sponsor: "Loja Exemplo", videoKey: "ads/x.mp4", durationSec: 15 } })).id;
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

const T0 = new Date("2026-11-10T12:00:00Z");
const after = (s: number) => new Date(T0.getTime() + s * 1000);

async function watchAd(userId: string, episodeId: string, seconds = 16) {
  const { view } = await startAdView(db, { userId, episodeId, now: T0 });
  return completeAdView(db, { userId, viewId: view.id, now: after(seconds) });
}

describe("Oferta única: desbloquear 1 episódio com anúncio", () => {
  it("anúncio visto até ao fim desbloqueia o episódio, sem mexer no livro-razão", async () => {
    const fan = await makeUser(db);
    const { series, episodes, artist } = await makeArtistWithSeries(db, { freeEpisodes: 3 });
    const lines = await db.ledgerLine.count();
    const unlock = await watchAd(fan.id, episodes[3].id);
    expect(unlock.artistId).toBe(artist.id);
    expect(unlock.month).toBe("2026-11");
    expect((await episodeStates(db, fan.id, series, episodes))[episodes[3].id]).toBe("unlocked");
    expect((await db.entitlement.findFirstOrThrow({ where: { userId: fan.id } })).source).toBe("AD");
    expect(await db.ledgerLine.count()).toBe(lines);
    const ad = await db.ad.findUniqueOrThrow({ where: { id: adId } });
    expect(ad.impressions).toBeGreaterThan(0);
    expect(ad.completions).toBeGreaterThan(0);
  });

  it("só 1 vez na vida da conta: depois disso a oferta desaparece", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await watchAd(fan.id, episodes[1].id);
    expect(await adOfferStatus(db, fan)).toMatchObject({ used: 1, limit: 1, available: false });
    await expect(startAdView(db, { userId: fan.id, episodeId: episodes[2].id, now: T0 })).rejects.toThrow(/Já usaste/);
    const other = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await expect(startAdView(db, { userId: fan.id, episodeId: other.episodes[1].id, now: T0 })).rejects.toThrow(/Já usaste/);
  });

  it("o anúncio tem de ser visto até ao fim (tempo medido no servidor)", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const { view } = await startAdView(db, { userId: fan.id, episodeId: episodes[1].id, now: T0 });
    await expect(completeAdView(db, { userId: fan.id, viewId: view.id, now: after(5) })).rejects.toThrow(/até ao fim/);
    expect(await db.entitlement.count({ where: { userId: fan.id } })).toBe(0);
    await completeAdView(db, { userId: fan.id, viewId: view.id, now: after(14) }); // 15 s com 1,5 s de margem
    expect(await db.entitlement.count({ where: { userId: fan.id } })).toBe(1);
  });

  it("nunca há desbloqueio duplo: o mesmo anúncio e dois anúncios em paralelo", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const a = await startAdView(db, { userId: fan.id, episodeId: episodes[1].id, now: T0 });
    const b = await startAdView(db, { userId: fan.id, episodeId: episodes[2].id, now: T0 });
    const r = await Promise.allSettled([
      completeAdView(db, { userId: fan.id, viewId: a.view.id, now: after(20) }),
      completeAdView(db, { userId: fan.id, viewId: b.view.id, now: after(20) }),
      completeAdView(db, { userId: fan.id, viewId: a.view.id, now: after(20) }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.adUnlock.count({ where: { userId: fan.id } })).toBe(1);
    expect(await db.entitlement.count({ where: { userId: fan.id } })).toBe(1);
  });

  it("1 oferta por número de telefone, mesmo que a conta seja apagada e recriada", async () => {
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await watchAd(fan.id, episodes[1].id);
    await db.user.delete({ where: { id: fan.id } });
    const again = await db.user.create({ data: { name: "De novo", phone: fan.phone, passwordHash: "x", birthDate: new Date("2000-01-01") } });
    await expect(startAdView(db, { userId: again.id, episodeId: episodes[2].id, now: T0 })).rejects.toThrow(/Já usaste/);
  });

  it("não serve para episódios grátis ou já desbloqueados, nem de outra pessoa", async () => {
    const fan = await makeUser(db);
    const intruder = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 2 });
    await expect(startAdView(db, { userId: fan.id, episodeId: episodes[0].id, now: T0 })).rejects.toThrow(/grátis/);
    const { view } = await startAdView(db, { userId: fan.id, episodeId: episodes[2].id, now: T0 });
    await expect(completeAdView(db, { userId: intruder.id, viewId: view.id, now: after(20) })).rejects.toThrow(/inválido/);
  });

  it("o limite é editável no admin (ex.: 2)", async () => {
    await setSetting(db, "adOfferLimit", "2");
    const fan = await makeUser(db);
    const { episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    await watchAd(fan.id, episodes[1].id);
    await watchAd(fan.id, episodes[2].id);
    await expect(startAdView(db, { userId: fan.id, episodeId: episodes[3].id, now: T0 })).rejects.toThrow(/Já usaste/);
    await setSetting(db, "adOfferLimit", "1");
  });
});

describe("Fundo mensal de anúncios", () => {
  it("50% da receita do mês é dividida pelos artistas, conforme os episódios desbloqueados por anúncio", async () => {
    const admin = await makeUser(db, "ADMIN");
    const A = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const B = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const month = "2026-09";
    // Desbloqueios de setembro: A tem 2, B tem 1 (registados diretamente para este mês)
    for (const [artist, ep] of [[A, A.episodes[1]], [A, A.episodes[2]], [B, B.episodes[1]]] as const) {
      const u = await makeUser(db);
      const v = await db.adView.create({ data: { adId, userId: u.id, episodeId: ep.id, completedAt: new Date() } });
      await db.adUnlock.create({ data: { userId: u.id, phone: u.phone, episodeId: ep.id, artistId: artist.artist.id, adViewId: v.id, month } });
    }
    const revBefore = await balance(db, PLATFORM_REVENUE);
    await registerAdRevenue(db, { month, amountCents: 300000, sponsor: "Patrocinador", adminId: admin.id }); // 3.000 Kz
    expect(await balance(db, adPool(month))).toBe(150000);
    expect(await balance(db, PLATFORM_REVENUE)).toBe(revBefore + 150000);
    await expect(distributeAdPool(db, { month, adminId: admin.id, now: new Date("2026-09-20T12:00:00Z") })).rejects.toThrow(/mês terminar/);
    const r = await distributeAdPool(db, { month, adminId: admin.id, now: new Date("2026-10-02T12:00:00Z") });
    expect(r.allocations).toEqual({ [A.artist.id]: 100000, [B.artist.id]: 50000 });
    expect((await getArtistWallet(db, A.artist.id)).availableCents).toBe(100000);
    expect((await getArtistWallet(db, A.artist.id)).earnedTotalCents).toBe(100000);
    expect(await balance(db, adPool(month))).toBe(0);
    await expect(distributeAdPool(db, { month, adminId: admin.id, now: new Date("2026-10-02T12:00:00Z") })).rejects.toThrow(/nada para dividir/);
  });

  it("mês sem desbloqueios por anúncio: o fundo passa para o mês seguinte", async () => {
    const admin = await makeUser(db, "ADMIN");
    await registerAdRevenue(db, { month: "2026-07", amountCents: 100001, adminId: admin.id });
    const r = await distributeAdPool(db, { month: "2026-07", adminId: admin.id, now: new Date("2026-08-05T00:00:00Z") });
    expect(r.rolloverCents).toBe(50000);
    expect(await balance(db, adPool("2026-08"))).toBe(50000);
  });

  it("mês em hora de Luanda", () => {
    expect(monthKeyLuanda(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12");
  });
});
