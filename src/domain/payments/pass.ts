import type { PrismaClient } from "@prisma/client";
import { distributePassPool } from "../money/split";
import { PLATFORM_REVENUE, artistAvailable, passPool } from "../money/accounts";
import { balance, lockAccount, postEntry } from "../money/ledger";
import { nextWeekKey, weekDays, weekRange } from "../money/weeks";
import { notify, audit } from "../notify";
import { UserFacingError } from "../errors";
import { formatKz } from "@/lib/money";

/**
 * FECHO SEMANAL DO PASSE.
 * O fundo da semana (50% dos passes vendidos) é dividido pelos artistas na proporção
 * dos segundos vistos COM PASSE nessa semana. Restos de arredondamento → plataforma.
 * Sem visualizações → o fundo passa para a semana seguinte.
 * Corre automaticamente (cron às segundas) ou pelo botão no admin.
 */

const closeKey = (week: string) => `pass-close:${week}`;

export async function isWeekClosed(db: Pick<PrismaClient, "journalEntry">, week: string) {
  return !!(await db.journalEntry.findUnique({ where: { idempotencyKey: closeKey(week) } }));
}

export async function closePassWeek(db: PrismaClient, { week, adminId, now = new Date() }: { week: string; adminId: string | null; now?: Date }) {
  if (now < weekRange(week).end) throw new UserFacingError("Esta semana ainda não terminou.");

  return db.$transaction(async (tx) => {
    await lockAccount(tx, passPool(week));
    if (await tx.journalEntry.findUnique({ where: { idempotencyKey: closeKey(week) } }))
      throw new UserFacingError("Esta semana já foi fechada.");

    // As semanas fecham por ordem (o fundo que sobra passa para a seguinte).
    const pools = await tx.ledgerAccount.findMany({ where: { code: { startsWith: "pass-pool:" } }, select: { code: true } });
    for (const { code } of pools) {
      const w = code.slice("pass-pool:".length);
      if (w < week && (await balance(tx, passPool(w))) !== 0 && !(await tx.journalEntry.findUnique({ where: { idempotencyKey: closeKey(w) } })))
        throw new UserFacingError(`Fecha primeiro a semana ${w}.`);
    }

    const pool = await balance(tx, passPool(week));
    const { from, to } = weekDays(week);
    const logs = await tx.watchLog.groupBy({
      by: ["artistId"],
      where: { viaPass: true, day: { gte: from, lt: to } },
      _sum: { seconds: true },
    });
    const seconds = Object.fromEntries(logs.map((l) => [l.artistId, l._sum.seconds ?? 0]));
    const result = pool > 0 ? distributePassPool(pool, seconds) : { allocations: {} as Record<string, number>, remainderCents: 0, rolloverCents: pool };

    const description = `Fecho do passe ${week}`;
    if (pool === 0) {
      // Semana sem fundo: regista só a marca de "fechada".
      await tx.journalEntry.create({ data: { kind: "PASS_CLOSE", description, idempotencyKey: closeKey(week), createdById: adminId ?? undefined } });
    } else {
      const lines = [{ account: passPool(week), amountCents: pool }];
      for (const [artistId, cents] of Object.entries(result.allocations)) lines.push({ account: artistAvailable(artistId), amountCents: -cents });
      if (result.remainderCents) lines.push({ account: PLATFORM_REVENUE, amountCents: -result.remainderCents });
      if (result.rolloverCents) lines.push({ account: passPool(nextWeekKey(week)), amountCents: -result.rolloverCents });
      await postEntry(tx, {
        kind: result.rolloverCents ? "PASS_ROLLOVER" : "PASS_DISTRIBUTION",
        description,
        idempotencyKey: closeKey(week),
        createdById: adminId ?? undefined,
        lines,
      });
    }

    for (const [artistId, cents] of Object.entries(result.allocations)) {
      const artist = await tx.artistProfile.findUnique({ where: { id: artistId } });
      if (artist) await notify(tx, artist.userId, "Passe semanal", `+${formatKz(cents)} do passe da semana ${week}.`, "/artista/carteira");
    }
    await audit(tx, adminId, "PASS_WEEK_CLOSED", "Week", week, { pool, ...result });
    return { week, pool, ...result };
  });
}

/** Fecha, por ordem, todas as semanas já terminadas que ainda não foram fechadas. */
export async function closeEndedWeeks(db: PrismaClient, { adminId = null, now = new Date() }: { adminId?: string | null; now?: Date } = {}) {
  const results = [];
  for (let guard = 0; guard < 60; guard++) {
    const pools = await db.ledgerAccount.findMany({ where: { code: { startsWith: "pass-pool:" } }, select: { code: true } });
    const weeks = pools.map((p) => p.code.slice("pass-pool:".length)).sort();
    let next: string | null = null;
    for (const w of weeks) {
      if (weekRange(w).end <= now && !(await isWeekClosed(db, w))) { next = w; break; }
    }
    if (!next) break;
    results.push(await closePassWeek(db, { week: next, adminId, now }));
  }
  return results;
}
