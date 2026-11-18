import type { PrismaClient } from "@prisma/client";
import { getInts } from "../settings";
import { dayLuanda } from "@/lib/dates";

/**
 * PONTOS DE PRESENÇA: +5 por dia em que abres a app (com conta) e +30 a cada 7 dias seguidos.
 * Uma vez por dia (chave única). Pontos não são dinheiro.
 */
export async function claimDailyPresence(db: PrismaClient, userId: string, now = new Date()) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { pointsBlocked: true, role: true } });
  if (!u || u.pointsBlocked || u.role === "ADMIN") return null;
  const cfg = await getInts(db, ["dailyPresencePoints", "streakDays", "streakBonusPoints"]);
  if (cfg.dailyPresencePoints <= 0) return null;
  const today = dayLuanda(now).toISOString().slice(0, 10);
  const r = await db.pointsTransaction.createMany({ data: [{ userId, delta: cfg.dailyPresencePoints, reason: "DAILY", refKey: `daily:${userId}:${today}` }], skipDuplicates: true });
  if (r.count === 0) return null;
  // Dias seguidos (contando hoje): bónus a cada 7, 14, 21… dias seguidos
  const recent = await db.pointsTransaction.findMany({
    where: { userId, reason: "DAILY", createdAt: { gte: new Date(now.getTime() - 400 * 86400000) } },
    select: { refKey: true },
  });
  const days = new Set(recent.map((r) => r.refKey?.split(":")[2]));
  let streak = 0;
  while (days.has(dayLuanda(new Date(now.getTime() - streak * 86400000)).toISOString().slice(0, 10))) streak++;
  let bonus = 0;
  if (cfg.streakBonusPoints > 0 && streak > 0 && streak % cfg.streakDays === 0) {
    const b = await db.pointsTransaction.createMany({ data: [{ userId, delta: cfg.streakBonusPoints, reason: "STREAK", refKey: `streak:${userId}:${today}` }], skipDuplicates: true });
    if (b.count === 1) bonus = cfg.streakBonusPoints;
  }
  return { points: cfg.dailyPresencePoints, streak, bonus };
}
