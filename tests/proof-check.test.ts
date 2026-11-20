import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeUser, randomHash, resetTestDb } from "./helpers";
import { createCoinPaymentRequest } from "@/domain/payments/service";
import { amountsInText, checkPaymentProof, proofReasons, type ProofFacts } from "@/domain/payments/proof-check";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
  await db.coinPack.create({ data: { id: "p1000", priceKz: 1000, coins: 100, sortOrder: 1 } });
});
afterAll(async () => db.$disconnect());

const now = new Date("2026-11-18T14:00:00Z");
const ctx = { expectedKz: 1000, typedRef: "784512369", submittedAt: now, accountCreatedAt: new Date("2026-01-01"), requestsLast24h: 1 };
const facts = (text: string, extra: Partial<ProofFacts> = {}): ProofFacts => ({ text, software: null, created: null, modified: null, ...extra });
const good = "Multicaixa Express\nMontante: 1.000,00 Kz\nN.º Operação: 784512369\nData: 18/11/2026 14:32";

describe("Comprovativos suspeitos (só marca, nunca decide)", () => {
  it("comprovativo certo não é suspeito", () => {
    expect(amountsInText(good)).toContain(1000);
    expect(proofReasons(facts(good), ctx)).toEqual([]);
  });
  it("valor diferente do pacote", () => {
    expect(proofReasons(facts(good.replace("1.000,00", "100,00")), ctx).join(" ")).toMatch(/não bate com o pacote/);
  });
  it("n.º de operação escrito não aparece", () => {
    expect(proofReasons(facts(good), { ...ctx, typedRef: "999999999" }).join(" ")).toMatch(/n.º de operação/);
  });
  it("data com mais de 24 h", () => {
    expect(proofReasons(facts(good.replace("18/11/2026", "10/11/2026")), ctx).join(" ")).toMatch(/mais de 24 h/);
  });
  it("sinais de edição nos metadados", () => {
    expect(proofReasons(facts(good, { software: "Adobe Photoshop 25.0" }), ctx).join(" ")).toMatch(/edição/);
    expect(proofReasons(facts(good, { created: new Date("2026-11-18T13:00:00Z"), modified: new Date("2026-11-18T13:30:00Z") }), ctx).join(" ")).toMatch(/alterada/);
  });
  it("conta nova com vários pedidos", () => {
    expect(proofReasons(facts(good), { ...ctx, accountCreatedAt: new Date(now.getTime() - 3600_000), requestsLast24h: 3 }).join(" ")).toMatch(/Conta nova/);
  });
  it("sem texto lido (PDF / OCR falhou) não é suspeito por isso", () => {
    expect(proofReasons(facts(""), ctx)).toEqual([]);
  });

  it("guarda o resultado no pedido e avisa o admin; o pedido continua PENDENTE", async () => {
    const fan = await makeUser(db);
    const admin = await makeUser(db, "ADMIN");
    const p = await createCoinPaymentRequest(db, { userId: fan.id, packId: "p1000", method: "MULTICAIXA_EXPRESS", payerPhone: "+244923000000", transactionRef: "784512369", proofHash: randomHash(), storeProof: async () => "k" });
    const hoje = new Date(Date.now() + 3600_000).toISOString().slice(0, 10).split("-").reverse().join("/");
    const reasons = await checkPaymentProof(db, p.id, Buffer.from(""), "png", async () => facts(good.replace("1.000,00", "500,00").replace("18/11/2026", hoje)));
    expect(reasons!.length).toBe(1);
    const after = await db.paymentRequest.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.suspicious).toBe(true);
    expect(after.status).toBe("PENDING");
    expect(await db.notification.count({ where: { userId: admin.id, title: { contains: "suspeito" } } })).toBe(1);
  });

  it("lista negra: quem foi bloqueado não pode enviar comprovativos", async () => {
    const fan = await makeUser(db);
    await db.user.update({ where: { id: fan.id }, data: { paymentsBlockedAt: new Date() } });
    await expect(createCoinPaymentRequest(db, { userId: fan.id, packId: "p1000", method: "MULTICAIXA_EXPRESS", payerPhone: "+244923000000", transactionRef: "R12345678", proofHash: randomHash(), storeProof: async () => "k" })).rejects.toThrow(/não pode enviar/);
  });
});

describe("OCR real (português)", () => {
  it("lê o valor e o n.º de operação de uma imagem", async () => {
    const { readProofFacts } = await import("@/domain/payments/proof-check");
    const { createCanvas } = await import("@napi-rs/canvas");
    const c = createCanvas(700, 420);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 700, 420); g.fillStyle = "#000"; g.font = "28px sans-serif";
    good.split("\n").forEach((l, i) => g.fillText(l, 30, 60 + i * 60));
    const f = await readProofFacts(Buffer.from(c.toBuffer("image/png")), "png");
    expect(f.text ?? "").toMatch(/784512369/);
    expect(proofReasons(f, ctx)).toEqual([]);
  }, 60000);
});
