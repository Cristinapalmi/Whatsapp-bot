import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import { deleteArtist } from "@/domain/artists/delete";
import { confirmPayment, createCoinPaymentRequest } from "@/domain/payments/service";
import { unlockEpisodeWithCoins } from "@/domain/coins/service";
import { ledgerIsBalanced } from "@/domain/money/ledger";

let db: PrismaClient;
let adminId: string;
beforeAll(async () => {
  db = await resetTestDb();
  await db.setting.create({ data: { key: "pendingDays", value: "0" } });
  await db.coinPack.create({ data: { id: "p1000", priceKz: 1000, coins: 100, sortOrder: 1 } });
  adminId = (await makeUser(db, "ADMIN")).id;
});
afterAll(async () => {
  expect(await ledgerIsBalanced(db)).toBe(true);
  await db.$disconnect();
});

describe("Apagar artista (Admin → Artistas)", () => {
  it("sem registos de dinheiro: apaga artista, séries e a conta; outros não são tocados", async () => {
    const other = await makeArtistWithSeries(db);
    const { artist, series } = await makeArtistWithSeries(db);
    await db.series.update({ where: { id: series.id }, data: { coverKey: "covers/x.jpg" } });
    const deleted: string[] = [];
    const r = await deleteArtist(db, adminId, artist.id, async (k) => deleted.push(k));
    expect(r.mode).toBe("deleted");
    expect(deleted).toContain("covers/x.jpg");
    expect(await db.artistProfile.findUnique({ where: { id: artist.id } })).toBeNull();
    expect(await db.series.count({ where: { id: series.id } })).toBe(0);
    expect(await db.user.findUnique({ where: { id: artist.userId } })).toBeNull();
    expect(await db.artistProfile.findUnique({ where: { id: other.artist.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: adminId } })).not.toBeNull();
  });

  it("com vendas: os registos de dinheiro ficam; séries retiradas, ficheiros apagados, conta suspensa", async () => {
    const { artist, series, episodes } = await makeArtistWithSeries(db, { freeEpisodes: 1 });
    const fan = await makeUser(db);
    const p = await createCoinPaymentRequest(db, { userId: fan.id, packId: "p1000", method: "MULTICAIXA_EXPRESS", payerPhone: "+244923000000", transactionRef: `R${Math.random().toString(36).slice(2, 12)}`, proofHash: randomHash(), storeProof: async () => "k" });
    await confirmPayment(db, { paymentId: p.id, adminId });
    await unlockEpisodeWithCoins(db, { userId: fan.id, episodeId: episodes[1].id });
    const r = await deleteArtist(db, adminId, artist.id);
    expect(r.mode).toBe("archived");
    expect((await db.series.findUniqueOrThrow({ where: { id: series.id } })).status).toBe("HIDDEN");
    expect((await db.artistProfile.findUniqueOrThrow({ where: { id: artist.id } })).status).toBe("SUSPENDED");
    expect((await db.user.findUniqueOrThrow({ where: { id: artist.userId } })).disabled).toBe(true);
    expect(await db.coinSpend.count({ where: { artistId: artist.id } })).toBe(1); // nada de dinheiro apagado
    expect(await db.coinLot.count({ where: { userId: fan.id } })).toBe(1); // compra do fã intacta
  });

  it("recusa com levantamento pago e recusa contas de admin", async () => {
    const { artist } = await makeArtistWithSeries(db);
    await db.payoutRequest.create({ data: { artistId: artist.id, amountCents: 500000, method: "MULTICAIXA_EXPRESS", holderName: "X", mcxPhone: "+244923000000", status: "PAID" } });
    await expect(deleteArtist(db, adminId, artist.id)).rejects.toThrow(/levantamentos/);
    const adminArtist = await makeArtistWithSeries(db);
    await db.user.update({ where: { id: adminArtist.artist.userId }, data: { role: "ADMIN" } });
    await expect(deleteArtist(db, adminId, adminArtist.artist.id)).rejects.toThrow(/administração/);
  });
});
