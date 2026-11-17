import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { closeEndedWeeks } from "@/domain/payments/pass";

/**
 * Fecho semanal automático do passe. A Vercel chama este endereço às segundas
 * (ver vercel.json) com o cabeçalho "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const results = await closeEndedWeeks(db);
  return NextResponse.json({ closed: results.map((r) => ({ week: r.week, pool: r.pool, rollover: r.rolloverCents })) });
}
