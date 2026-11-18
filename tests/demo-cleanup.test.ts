import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, randomHash, resetTestDb } from "./helpers";
import { analyzeDemo, runDemoCleanup } from "@/domain/demo-cleanup";
import { confirmPayment, createCoinPaymentRequest } from "@/domain/payments/service";
import { coinBalance, unlockEpisodeWithCoins } from "@/domain/coins/service";
import { balance, ledgerIsBalanced } from "@/domain/money/ledger";
import { COINS_OUTSTANDING } from "@/domain/money/accounts";

let db: PrismaClient;
let admin: { id: string };
let paulo: { id: string };

const DEMO = [
  ["+244900000002", "manazinha", "a-kianda-do-mussulo"],
  ["+244900000012", "tiogingas", "as-makas-da-tia-bela"],
  ["+244900000013", "kotabento", "o-candongueiro-assombrado"],
];

async function createDemo() {
  for (const [phone, slug, seriesSlug] of DEMO) {
    const u = await db.user.create({ data: { name: `Demo ${slug}`, phone, passwordHash: "x", birthDate: new Date("1994-01-01"), role: "ARTIST" } });
    const a = await db.artistProfile.create({
      data: { userId: u.id, stageName: slug, fullName: "Demo", biNumber: "000000000LA000", email: `${slug}@exemplo.ao`, socialUrl: "https://tiktok.com/@x", category: "TERROR", slug, status: "APPROVED" },
    });
    await db.series.create({
      data: {
        artistId: a.id, title: seriesSlug, slug: seriesSlug, category: "TERROR", status: "PUBLISHED", tier: "NORMAL", freeEpisodes: 3, coverKey: `/covers/${seriesSlug}.svg`,
        episodes: { create: [1, 2, 3, 4].map((n) => ({ number: n, title: `Ep ${n}`, published: true, videoKey: "/samples/demo-360.mp4", durationSec: 15 })) },
      },
    });
  }
  await db.user.create({ data: { name: "Fã de Teste", phone: "+244900000003", passwordHash: "x", birthDate: new Date("2000-01-01") } });
}

beforeAll(async () => {
  db = await resetTestDb();
  await db.coinPack.create({ data: { id: "p1000", priceKz: 1000, coins: 100 } });
  admin = await db.user.create({ data: { name: "Administração", phone: "+244923000001", passwordHash: "x", birthDate: new Date("1990-01-01"), role: "ADMIN" } });
  paulo = await db.user.create({ data: { name: "Paulo Riquinho", phone: "+244974044962", passwordHash: "x", birthDate: new Date("1995-01-01") } });
  const p = await createCoinPaymentRequest(db, { userId: paulo.id, packId: "p1000", method: "MULTICAIXA_EXPRESS", payerPhone: "+244974044962", transactionRef: "MCX123456", proofHash: randomHash(), storeProof: async () => "k" });
  await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

describe("Limpeza do demo", () => {
  it("apaga só o demo; a conta de admin, o Paulo, a compra dele e a contabilidade ficam", async () => {
    await createDemo();
    const real = await makeArtistWithSeries(db); // artista verdadeiro, não pode ser apagado
    const outBefore = await balance(db, COINS_OUTSTANDING);
    const linesBefore = await db.ledgerLine.count();

    const r = await runDemoCleanup(db);
    expect(r.status).toBe("done");
    expect(await db.series.count({ where: { slug: { in: DEMO.map((d) => d[2]) } } })).toBe(0);
    expect(await db.user.count({ where: { phone: { in: ["+244900000002", "+244900000012", "+244900000013", "+244900000003"] } } })).toBe(0);
    expect(await db.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: paulo.id } })).not.toBeNull();
    expect(await coinBalance(db, paulo.id)).toBe(100);
    expect(await balance(db, COINS_OUTSTANDING)).toBe(outBefore);
    expect(await db.ledgerLine.count()).toBe(linesBefore);
    expect(await db.series.findUnique({ where: { id: real.series.id } })).not.toBeNull();
    expect(await db.artistProfile.findUnique({ where: { id: real.artist.id } })).not.toBeNull();
  });

  it("corre uma única vez", async () => {
    await createDemo();
    expect((await runDemoCleanup(db)).status).toBe("done");
    expect(await db.series.count({ where: { slug: "a-kianda-do-mussulo" } })).toBe(1); // não voltou a apagar
    await db.setting.delete({ where: { key: "demoCleanup" } });
  });

  it("se um fã real gastou moedas no demo, NÃO apaga e avisa; ao confirmar, devolve as moedas e apaga", async () => {
    const kianda = await db.series.findUniqueOrThrow({ where: { slug: "a-kianda-do-mussulo" }, include: { episodes: { orderBy: { number: "asc" } } } });
    await unlockEpisodeWithCoins(db, { userId: paulo.id, episodeId: kianda.episodes[3].id });
    expect(await coinBalance(db, paulo.id)).toBe(80);

    const blocked = await runDemoCleanup(db);
    expect(blocked.status).toBe("blocked");
    if (blocked.status === "blocked") expect(blocked.blockers[0].who).toContain("Paulo Riquinho");
    expect(await db.series.count({ where: { slug: "a-kianda-do-mussulo" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: admin.id, title: "Limpeza do demo em pausa" } })).toBe(1);

    const done = await runDemoCleanup(db, { force: true, adminId: admin.id });
    expect(done.status).toBe("done");
    expect(await coinBalance(db, paulo.id)).toBe(100); // moedas devolvidas
    expect(await db.series.count({ where: { slug: "a-kianda-do-mussulo" } })).toBe(0);
    expect((await analyzeDemo(db)).counts.series).toBe(0);
  });
});
