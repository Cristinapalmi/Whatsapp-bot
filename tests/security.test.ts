import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { isSameOrigin } from "@/lib/origin";
import { passwordSchema } from "@/lib/validation";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import { confirmPayment, createEpisodePaymentRequest } from "@/domain/payments/service";
import { requestPayout } from "@/domain/payouts/service";

describe("Proteção CSRF nas rotas POST", () => {
  const req = (h: Record<string, string>) => new Request("https://konta.ao/api/x", { method: "POST", headers: h });
  it("aceita pedidos do próprio site e recusa de outros sites", () => {
    expect(isSameOrigin(req({ origin: "https://konta.ao", host: "konta.ao" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://site-mau.com", host: "konta.ao" }))).toBe(false);
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site", host: "konta.ao" }))).toBe(false);
    expect(isSameOrigin(req({ host: "konta.ao" }))).toBe(true);
  });
});

describe("Palavras-passe", () => {
  it("mínimo 8 caracteres", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });
});

describe("Levantamentos sem duplicados", () => {
  let db: PrismaClient;
  beforeAll(async () => {
    db = await resetTestDb();
  });
  afterAll(async () => {
    await db.$disconnect();
  });
  it("só um levantamento em processamento de cada vez", async () => {
    const ctx = await makeArtistWithSeries(db, { priceCents: 15000, freeEpisodes: 0 });
    const admin = await makeUser(db, "ADMIN");
    for (let i = 0; i < 140; i++) {
      const fan = await makeUser(db);
      const p = await createEpisodePaymentRequest(db, { userId: fan.id, episodeId: ctx.episodes[0].id, method: "MULTICAIXA_EXPRESS", payerPhone: "+244923000000", transactionRef: `R${i}x${Date.now()}`, proofHash: randomHash(), storeProof: async () => "k" });
      await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    }
    await db.payoutAccount.create({ data: { artistId: ctx.artist.id, holderName: "Nome Completo", method: "MULTICAIXA_EXPRESS", mcxPhone: "+244923111111" } });
    await requestPayout(db, { artistId: ctx.artist.id, amountCents: 500000 });
    await expect(requestPayout(db, { artistId: ctx.artist.id, amountCents: 500000 })).rejects.toThrow(/em processamento/);
  });
});
