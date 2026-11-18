import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteObject } from "@/domain/storage";
import { purgeWithdrawnSeries } from "@/domain/series-workflow";

/**
 * Tarefas diárias (a Vercel chama às 02:10 com "Authorization: Bearer <CRON_SECRET>"):
 * - apaga os vídeos e capas de séries retiradas há mais de 30 dias (os registos de dinheiro ficam).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const purged = await purgeWithdrawnSeries(db, new Date(), (k) => deleteObject("media", k));
  return NextResponse.json({ purged });
}
