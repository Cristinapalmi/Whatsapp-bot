import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeUser, randomHash, resetTestDb } from "./helpers";
import { setSetting } from "@/domain/coins/service";
import { confirmPayment, createCoinPaymentRequest } from "@/domain/payments/service";
import { blockFromPoints, ensureInviteCode, inviteSummary, onInviteeCompletion, processPendingInvites, recordInviteOnSignup, voidInvite } from "@/domain/fans/invites";
import { claimDailyPresence } from "@/domain/fans/presence";
import { pointsBalance } from "@/domain/points";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
  await db.coinPack.create({ data: { id: "p1000", priceKz: 1000, coins: 100, sortOrder: 1 } });
});
afterAll(async () => db.$disconnect());

const H = 3600_000;
const D = 24 * H;

async function invited(opts: { device?: string; ip?: string } = {}) {
  const inviter = await makeUser(db);
  const code = await ensureInviteCode(db, inviter.id);
  const friend = await makeUser(db);
  const inv = await recordInviteOnSignup(db, { inviteeId: friend.id, code, deviceId: opts.device ?? `d-${Math.random()}`, ip: opts.ip ?? null });
  return { inviter, friend, inv: inv! };
}

describe("Convites de fãs", () => {
  it("+50 para os dois só se o amigo voltar outro dia e passarem 48 h", async () => {
    const { inviter, friend, inv } = await invited();
    expect(inv.status).toBe("PENDING");
    const t0 = new Date("2026-11-10T10:00:00Z");
    await onInviteeCompletion(db, friend.id, t0); // 1.º episódio
    await onInviteeCompletion(db, friend.id, new Date(t0.getTime() + 2 * H)); // mesmo dia: não conta
    expect((await db.fanInvite.findUniqueOrThrow({ where: { id: inv.id } })).returnedAt).toBeNull();
    expect(await onInviteeCompletion(db, friend.id, new Date(t0.getTime() + D))).toBe("waiting"); // outro dia, mas < 48 h
    expect(await pointsBalance(db, inviter.id)).toBe(0);
    await processPendingInvites(db, new Date(t0.getTime() + 49 * H));
    expect(await pointsBalance(db, inviter.id)).toBe(50);
    expect(await pointsBalance(db, friend.id)).toBe(50);
    // não dá duas vezes
    await processPendingInvites(db, new Date(t0.getTime() + 60 * H));
    expect(await pointsBalance(db, inviter.id)).toBe(50);
  });

  it("amigo que nunca volta não dá nada (expira)", async () => {
    const { inviter, friend, inv } = await invited();
    await onInviteeCompletion(db, friend.id, new Date(Date.now() - 20 * D));
    await db.fanInvite.update({ where: { id: inv.id }, data: { createdAt: new Date(Date.now() - 20 * D) } });
    await processPendingInvites(db);
    expect((await db.fanInvite.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("EXPIRED");
    expect(await pointsBalance(db, inviter.id)).toBe(0);
  });

  it("mesmo aparelho → suspeito, sem pontos; admin pode anular e bloquear", async () => {
    const inviter = await makeUser(db);
    await db.user.update({ where: { id: inviter.id }, data: { signupDeviceId: "AAA" } });
    const code = await ensureInviteCode(db, inviter.id);
    const f = await makeUser(db);
    const inv = await recordInviteOnSignup(db, { inviteeId: f.id, code, deviceId: "AAA", ip: null });
    expect(inv!.status).toBe("SUSPICIOUS");
    const t0 = new Date(Date.now() - 5 * D);
    await onInviteeCompletion(db, f.id, t0);
    await onInviteeCompletion(db, f.id, new Date(t0.getTime() + D));
    await processPendingInvites(db);
    expect(await pointsBalance(db, inviter.id)).toBe(0);
    const admin = await makeUser(db, "ADMIN");
    await blockFromPoints(db, admin.id, inviter.id);
    expect((await db.fanInvite.findUniqueOrThrow({ where: { id: inv!.id } })).status).toBe("VOID");
    expect((await db.user.findUniqueOrThrow({ where: { id: inviter.id } })).pointsBlocked).toBe(true);
  });

  it("anular um convite válido retira os pontos", async () => {
    const { inviter, friend, inv } = await invited();
    const t0 = new Date(Date.now() - 5 * D);
    await onInviteeCompletion(db, friend.id, t0);
    await onInviteeCompletion(db, friend.id, new Date(t0.getTime() + D));
    await processPendingInvites(db);
    expect(await pointsBalance(db, inviter.id)).toBe(50);
    await voidInvite(db, (await makeUser(db, "ADMIN")).id, inv.id);
    expect(await pointsBalance(db, inviter.id)).toBe(0);
    expect(await pointsBalance(db, friend.id)).toBe(0);
  });

  it("limite de convites com prémio por mês", async () => {
    await setSetting(db, "inviteMonthlyLimit", "1");
    const inviter = await makeUser(db);
    const code = await ensureInviteCode(db, inviter.id);
    for (let i = 0; i < 2; i++) {
      const f = await makeUser(db);
      await recordInviteOnSignup(db, { inviteeId: f.id, code, deviceId: `x${i}`, ip: null });
      const t0 = new Date(Date.now() - 3 * D);
      await onInviteeCompletion(db, f.id, t0);
      await onInviteeCompletion(db, f.id, new Date(t0.getTime() + D));
    }
    await processPendingInvites(db);
    expect(await pointsBalance(db, inviter.id)).toBe(50);
    expect((await inviteSummary(db, inviter.id)).valid).toBe(1);
    await setSetting(db, "inviteMonthlyLimit", "10");
  });

  it("1.ª compra confirmada do amigo dá +200 a quem convidou, uma vez", async () => {
    const { inviter, friend } = await invited();
    const admin = await makeUser(db, "ADMIN");
    for (let i = 0; i < 2; i++) {
      const p = await createCoinPaymentRequest(db, { userId: friend.id, packId: "p1000", method: "MULTICAIXA_EXPRESS", payerPhone: "+244923000000", transactionRef: `R${Math.random().toString(36).slice(2, 12)}`, proofHash: randomHash(), storeProof: async () => "k" });
      await confirmPayment(db, { paymentId: p.id, adminId: admin.id });
    }
    expect(await pointsBalance(db, inviter.id)).toBe(200);
  });

  it("não se pode convidar a si próprio", async () => {
    const u = await makeUser(db);
    const code = await ensureInviteCode(db, u.id);
    expect(await recordInviteOnSignup(db, { inviteeId: u.id, code, deviceId: null, ip: null })).toBeNull();
  });
});

describe("Pontos de presença", () => {
  it("+5 por dia, uma vez; +30 aos 7 dias seguidos", async () => {
    const u = await makeUser(db);
    const base = new Date("2026-10-01T12:00:00Z");
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const r = await claimDailyPresence(db, u.id, new Date(base.getTime() + i * D));
      total += (r?.points ?? 0) + (r?.bonus ?? 0);
      expect(await claimDailyPresence(db, u.id, new Date(base.getTime() + i * D + H))).toBeNull();
    }
    expect(total).toBe(7 * 5 + 30);
    expect(await pointsBalance(db, u.id)).toBe(65);
  });
});
