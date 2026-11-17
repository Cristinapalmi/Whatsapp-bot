import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeArtistWithSeries, makeUser, randomHash, resetTestDb } from "./helpers";
import { confirmPayment, createEpisodePaymentRequest, createGiftPaymentRequest, reversePayment } from "@/domain/payments/service";
import { markPayoutPaid, requestPayout } from "@/domain/payouts/service";
import { getArtistWallet } from "@/domain/money/ledger";
import { artistStatement, artistsEarningsSummary } from "@/domain/reports";
import { csvCell, csvKz, toCsv } from "@/lib/csv";
import { buildTrailerArgs, chooseClip, parseProbe } from "@/domain/trailer";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
});
afterAll(async () => {
  await db.$disconnect();
});

const proof = () => ({
  method: "MULTICAIXA_EXPRESS" as const,
  payerPhone: "+244923000000",
  transactionRef: `R${Math.random().toString(36).slice(2, 12)}`,
  proofHash: randomHash(),
  storeProof: async () => "k",
});

describe("Extrato mensal do artista", () => {
  it("abertura + movimentos = fecho, e bate com a carteira", async () => {
    const admin = await makeUser(db, "ADMIN");
    const { artist, episodes } = await makeArtistWithSeries(db, { priceCents: 15000, freeEpisodes: 0 });
    await db.payoutAccount.create({ data: { artistId: artist.id, holderName: "Nome Completo", method: "MULTICAIXA_EXPRESS", mcxPhone: "+244923111111" } });
    const pays = [];
    for (let i = 0; i < 70; i++) {
      const fan = await makeUser(db);
      const p = await createEpisodePaymentRequest(db, { userId: fan.id, episodeId: episodes[0].id, ...proof() });
      await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
      pays.push(p);
    }
    const fan = await makeUser(db);
    const g = await createGiftPaymentRequest(db, { userId: fan.id, artistId: artist.id, giftId: "GRADE", ...proof() });
    await confirmPayment(db, { paymentId: g.id, adminId: admin.id });
    await reversePayment(db, { paymentId: pays[0].id, adminId: admin.id, reason: "teste" });
    const p1 = await requestPayout(db, { artistId: artist.id, amountCents: 500000 });
    await markPayoutPaid(db, { payoutId: p1.id, adminId: admin.id });

    const st = await artistStatement(db, artist.id);
    expect(st.openingCents).toBe(0);
    expect(st.totals.EPISODE).toBe(70 * 7500);
    expect(st.totals.GIFT).toBe(25000);
    expect(st.totals.REVERSAL).toBe(-7500);
    expect(st.totals.PAYOUT_REQUEST).toBe(-500000);
    expect(st.earnedCents).toBe(70 * 7500 + 25000 - 7500);
    expect(st.payoutsPaid).toEqual({ count: 1, cents: 500000 });
    const sum = st.movements.reduce((a, m) => a + m.amountCents, 0);
    expect(st.closingCents).toBe(st.openingCents + sum);
    expect(st.closingCents).toBe((await getArtistWallet(db, artist.id)).availableCents);

    // mês anterior: sem movimentos
    const prev = await artistStatement(db, artist.id, "2020-01");
    expect(prev.movements).toHaveLength(0);
    // resumo geral inclui o artista
    const summary = await artistsEarningsSummary(db);
    expect(summary.find((s) => s.artist.id === artist.id)?.earnedCents).toBe(st.earnedCents);
  });
});

describe("CSV", () => {
  it("formato Excel PT e proteção contra fórmulas", () => {
    expect(csvKz(123450)).toBe("1234,50");
    expect(csvKz(-7500)).toBe("-75,00");
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("-75,00")).toBe('"-75,00"');
    expect(csvCell("+244923000000")).toBe('"+244923000000"');
    expect(csvCell("+cmd")).toBe(`"'+cmd"`);
    const csv = toCsv(["a", "b"], [["1;2", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"1;2";""');
  });
});

describe("Trailer", () => {
  it("lê a duração e se há som", () => {
    const info = parseProbe("Duration: 00:02:05.50, start: 0\n Stream #0:1[0x2](und): Audio: aac");
    expect(info).toEqual({ durationSec: 125.5, hasAudio: true });
    expect(parseProbe("Duration: 00:00:10.00").hasAudio).toBe(false);
  });
  it("escolhe um excerto até 25 s sem passar o fim", () => {
    expect(chooseClip(120, 10)).toEqual({ startSec: 10, clipSec: 25 });
    expect(chooseClip(15, 0)).toEqual({ startSec: 0, clipSec: 15 });
    expect(chooseClip(20, 30)).toEqual({ startSec: 17, clipSec: 3 });
    expect(() => chooseClip(0)).toThrow();
  });
  it("monta o comando com o cartão final de 5 s e silêncio quando o vídeo não tem som", () => {
    const args = buildTrailerArgs({ input: "in.mp4", output: "out.mp4", startSec: 3, clipSec: 25, endCardSec: 5, hasAudio: false, bannerPng: "b.png", endCardPng: "e.png" });
    const fc = args[args.indexOf("-filter_complex") + 1];
    expect(fc).toContain("trim=start=3:duration=25");
    expect(fc).toContain("anullsrc=r=44100:cl=stereo,atrim=duration=25[ma]");
    expect(fc).toContain("concat=n=2:v=1:a=1");
    expect(args.slice(-1)[0]).toBe("out.mp4");
  });
});
