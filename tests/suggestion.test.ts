import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, resetTestDb } from "./helpers";
import { resolveSuggestedSeries, todayLuanda } from "@/domain/suggestion";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
});
afterAll(async () => {
  await db.$disconnect();
});

describe("Sugestão ao abrir a app", () => {
  it("sem séries publicadas não sugere nada", async () => {
    expect(await resolveSuggestedSeries(db)).toBeNull();
  });

  it("usa a mais vista, depois a em destaque, depois a escolhida no admin", async () => {
    const a = await makeArtistWithSeries(db);
    const b = await makeArtistWithSeries(db);
    const fan = await makeUser(db);
    await db.watchProgress.create({ data: { userId: fan.id, episodeId: b.episodes[0].id } });
    expect((await resolveSuggestedSeries(db))?.id).toBe(b.series.id); // mais vista

    await db.series.update({ where: { id: a.series.id }, data: { featured: true } });
    expect((await resolveSuggestedSeries(db))?.id).toBe(a.series.id); // em destaque

    const c = await makeArtistWithSeries(db);
    await db.setting.create({ data: { key: "suggestedSeriesId", value: c.series.id } });
    const s = await resolveSuggestedSeries(db);
    expect(s?.id).toBe(c.series.id); // escolhida no admin
    expect(s?.episodes[0].id).toBe(c.episodes[0].id); // "Começar a ver" vai para o episódio 1
  });

  it("se a série escolhida for retirada, volta à automática", async () => {
    const chosen = await db.setting.findUniqueOrThrow({ where: { key: "suggestedSeriesId" } });
    await db.series.update({ where: { id: chosen.value }, data: { status: "HIDDEN" } });
    const s = await resolveSuggestedSeries(db);
    expect(s?.id).not.toBe(chosen.value);
    expect(s?.featured).toBe(true);
  });

  it("o dia conta em hora de Luanda", () => {
    expect(todayLuanda(new Date("2026-11-18T23:30:00Z"))).toBe("2026-11-19");
    expect(todayLuanda(new Date("2026-11-18T22:30:00Z"))).toBe("2026-11-18");
  });
});
