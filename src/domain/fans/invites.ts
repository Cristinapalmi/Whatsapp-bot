import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { notify, audit } from "../notify";
import { getInts } from "../settings";
import type { Tx } from "../money/ledger";
import { dayLuanda } from "@/lib/dates";

/**
 * CONVITES DE FÃS — regras (os pontos NÃO são dinheiro):
 *  - O amigo cria conta pelo link e vê 1 episódio até ao fim (tempo validado no servidor).
 *  - Os +50 pontos (para os dois) ficam em espera 48 h e só entram se o amigo VOLTAR outro dia
 *    e vir outro episódio até ao fim. Contas que nunca voltam não dão nada.
 *  - 1.ª compra de moedas do amigo (confirmada pelo admin) → +200 pontos para quem convidou.
 *  - Anti-batota: 1 convite por conta/telefone; mesmo aparelho ou ligação repetida → "suspeito"
 *    (sem pontos, o admin decide); máximo de convites com prémio por mês; quem é bloqueado não ganha.
 */

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from(randomBytes(7), (b) => ALPHA[b % ALPHA.length]).join("");

export async function ensureInviteCode(db: PrismaClient, userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { inviteCode: true } });
  if (u.inviteCode) return u.inviteCode;
  for (let i = 0; i < 5; i++) {
    const c = code();
    try {
      const r = await db.user.updateMany({ where: { id: userId, inviteCode: null }, data: { inviteCode: c } });
      if (r.count === 1) return c;
    } catch {}
    const again = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { inviteCode: true } });
    if (again.inviteCode) return again.inviteCode;
  }
  throw new Error("Não foi possível criar o código de convite");
}

export const inviteCfg = (db: Tx) =>
  getInts(db, ["inviteWatchPoints", "invitePurchasePoints", "invitePendingHours", "inviteExpireDays", "inviteMonthlyLimit", "ambassadorInvites"]);

/** Ao criar conta com um convite. Marca como suspeito se o aparelho/ligação se repetir. */
export async function recordInviteOnSignup(db: PrismaClient, p: { inviteeId: string; code: string; deviceId: string | null; ip: string | null }) {
  const inviter = await db.user.findUnique({ where: { inviteCode: p.code.toUpperCase() }, select: { id: true, signupDeviceId: true, signupIp: true, pointsBlocked: true } });
  if (!inviter || inviter.id === p.inviteeId) return null;
  const since = new Date(Date.now() - 30 * 86400000);
  const reasons: string[] = [];
  if (p.deviceId && inviter.signupDeviceId === p.deviceId) reasons.push("mesmo aparelho de quem convidou");
  if (p.deviceId && (await db.fanInvite.count({ where: { inviterId: inviter.id, deviceId: p.deviceId } })) >= 1) reasons.push("várias contas do mesmo aparelho");
  if (p.ip && (await db.fanInvite.count({ where: { inviterId: inviter.id, ip: p.ip, createdAt: { gte: since } } })) >= 3) reasons.push("muitas contas da mesma ligação");
  if (p.deviceId && (await db.user.count({ where: { signupDeviceId: p.deviceId, createdAt: { gte: since } } })) >= 3) reasons.push("muitas contas criadas neste aparelho");
  if (inviter.pointsBlocked) reasons.push("quem convidou está bloqueado");
  return db.fanInvite.create({
    data: { inviterId: inviter.id, inviteeId: p.inviteeId, deviceId: p.deviceId, ip: p.ip, status: reasons.length ? "SUSPICIOUS" : "PENDING", reason: reasons.join("; ") || null },
  });
}

async function givePoints(tx: Prisma.TransactionClient, userId: string, delta: number, reason: string, refKey: string) {
  if (delta === 0) return false;
  const r = await tx.pointsTransaction.createMany({ data: [{ userId, delta, reason, refKey }], skipDuplicates: true });
  return r.count === 1;
}

/** O amigo viu um episódio até ao fim (1.ª vez nesse episódio). */
export async function onInviteeCompletion(db: PrismaClient, inviteeId: string, now = new Date()) {
  const inv = await db.fanInvite.findUnique({ where: { inviteeId } });
  if (!inv || inv.status !== "PENDING") return null;
  const today = dayLuanda(now).toISOString().slice(0, 10);
  if (!inv.firstWatchAt) {
    await db.fanInvite.update({ where: { id: inv.id }, data: { firstWatchAt: now, firstWatchDay: today } });
    const cfg = await inviteCfg(db);
    await notify(db, inv.inviterId, "O teu amigo começou a ver 👀", `Um amigo que convidaste viu o primeiro episódio. Se voltar outro dia e vir outro, ganham os dois ${cfg.inviteWatchPoints} pontos.`, "/convidar");
  } else if (!inv.returnedAt && inv.firstWatchDay !== today) {
    await db.fanInvite.update({ where: { id: inv.id }, data: { returnedAt: now } });
  }
  return tryValidateInvite(db, inv.id, now);
}

/** Dá os pontos se o convite cumprir todas as regras. */
export async function tryValidateInvite(db: PrismaClient, inviteId: string, now = new Date()) {
  const cfg = await inviteCfg(db);
  const inv = await db.fanInvite.findUnique({ where: { id: inviteId }, include: { inviter: { select: { pointsBlocked: true } } } });
  if (!inv || inv.status !== "PENDING" || !inv.firstWatchAt || !inv.returnedAt) return null;
  if (now.getTime() < inv.firstWatchAt.getTime() + cfg.invitePendingHours * 3600_000) return "waiting";
  if (inv.inviter.pointsBlocked) {
    await db.fanInvite.update({ where: { id: inv.id }, data: { status: "VOID", reason: "quem convidou está bloqueado" } });
    return "void";
  }
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"invites:" + inv.inviterId}))`;
    const used = await tx.fanInvite.count({ where: { inviterId: inv.inviterId, status: "VALID", validatedAt: { gte: monthStart } } });
    if (used >= cfg.inviteMonthlyLimit) {
      await tx.fanInvite.update({ where: { id: inv.id }, data: { status: "LIMIT", reason: "limite de convites do mês" } });
      return "limit" as const;
    }
    const upd = await tx.fanInvite.updateMany({ where: { id: inv.id, status: "PENDING" }, data: { status: "VALID", validatedAt: now } });
    if (upd.count !== 1) return null;
    await givePoints(tx, inv.inviterId, cfg.inviteWatchPoints, "INVITE_WATCH", `invite:${inv.id}:watch:${inv.inviterId}`);
    await givePoints(tx, inv.inviteeId, cfg.inviteWatchPoints, "INVITE_WATCH", `invite:${inv.id}:watch:${inv.inviteeId}`);
    return "valid" as const;
  });
  if (result === "valid") {
    await notify(db, inv.inviterId, "Convite válido 🎉", `O teu amigo voltou e continuou a ver. Ganhaste ${cfg.inviteWatchPoints} pontos!`, "/convidar");
    await notify(db, inv.inviteeId, "Bónus de boas-vindas 🎉", `Ganhaste ${cfg.inviteWatchPoints} pontos por vires pelo convite de um amigo.`, "/conta");
    const valid = await db.fanInvite.count({ where: { inviterId: inv.inviterId, status: "VALID" } });
    if (valid === cfg.ambassadorInvites)
      await notify(db, inv.inviterId, "Embaixador KONTA 🏅", "Chegaste aos convites válidos para seres Embaixador. O selo já está no teu perfil!", "/convidar");
  }
  return result;
}

/** Corre todos os dias: valida convites prontos e fecha os de amigos que nunca voltaram. */
export async function processPendingInvites(db: PrismaClient, now = new Date()) {
  const cfg = await inviteCfg(db);
  const ready = await db.fanInvite.findMany({ where: { status: "PENDING", returnedAt: { not: null } }, select: { id: true } });
  for (const r of ready) await tryValidateInvite(db, r.id, now);
  const expired = await db.fanInvite.updateMany({
    where: { status: "PENDING", returnedAt: null, createdAt: { lt: new Date(now.getTime() - cfg.inviteExpireDays * 86400000) } },
    data: { status: "EXPIRED", reason: "o amigo não voltou" },
  });
  return { checked: ready.length, expired: expired.count };
}

/** 1.ª compra de moedas confirmada do amigo → pontos para quem convidou (uma vez). Chamar dentro da confirmação. */
export async function onInviteePurchaseConfirmed(tx: Prisma.TransactionClient, inviteeId: string) {
  const inv = await tx.fanInvite.findUnique({ where: { inviteeId }, include: { inviter: { select: { pointsBlocked: true } } } });
  if (!inv || !["PENDING", "VALID", "LIMIT"].includes(inv.status) || inv.inviter.pointsBlocked) return false;
  const upd = await tx.fanInvite.updateMany({ where: { id: inv.id, purchaseBonusAt: null }, data: { purchaseBonusAt: new Date() } });
  if (upd.count !== 1) return false;
  const cfg = await inviteCfg(tx);
  const ok = await givePoints(tx, inv.inviterId, cfg.invitePurchasePoints, "INVITE_PURCHASE", `invite:${inv.id}:purchase`);
  if (ok) await notify(tx, inv.inviterId, "Bónus de convite 💰", `O teu amigo fez a primeira compra de moedas. Ganhaste ${cfg.invitePurchasePoints} pontos!`, "/convidar");
  return ok;
}

/** Admin: anular os pontos de um convite. */
export async function voidInvite(db: PrismaClient, adminId: string, inviteId: string) {
  await db.$transaction(async (tx) => {
    const inv = await tx.fanInvite.findUniqueOrThrow({ where: { id: inviteId } });
    const given = await tx.pointsTransaction.findMany({ where: { refKey: { startsWith: `invite:${inv.id}:` }, delta: { gt: 0 } } });
    for (const g of given) await givePoints(tx, g.userId, -g.delta, "INVITE_VOID", `${g.refKey}:void`);
    await tx.fanInvite.update({ where: { id: inv.id }, data: { status: "VOID", reason: inv.reason ? `${inv.reason}; anulado pelo admin` : "anulado pelo admin" } });
    await audit(tx, adminId, "INVITE_VOIDED", "FanInvite", inv.id, { points: given.length });
  });
}

/** Admin: bloquear alguém nos pontos (anula os convites pendentes/suspeitos dele). */
export async function blockFromPoints(db: PrismaClient, adminId: string, userId: string) {
  await db.user.update({ where: { id: userId }, data: { pointsBlocked: true } });
  const open = await db.fanInvite.findMany({ where: { inviterId: userId, status: { in: ["PENDING", "SUSPICIOUS"] } }, select: { id: true } });
  for (const i of open) await voidInvite(db, adminId, i.id);
  await audit(db, adminId, "POINTS_BLOCKED", "User", userId, { invites: open.length });
}

/** Resumo para a página "Convidar amigos". */
export async function inviteSummary(db: Tx, userId: string) {
  const cfg = await inviteCfg(db);
  const rows = await db.fanInvite.groupBy({ by: ["status"], where: { inviterId: userId }, _count: true });
  const count = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  const valid = count("VALID");
  return { valid, pending: count("PENDING") + count("SUSPICIOUS"), ambassador: valid >= cfg.ambassadorInvites, ambassadorTarget: cfg.ambassadorInvites, cfg };
}
