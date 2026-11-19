import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { releaseDuePending } from "@/domain/money/ledger";
import { deleteObject } from "@/domain/storage";
import { purgeWithdrawnSeries } from "@/domain/series-workflow";
import { checkAvailableBlocks, sendDailySummaries } from "@/domain/artists/growth";
import { processPendingInvites } from "@/domain/fans/invites";

/**
 * Tarefas diárias (a Vercel chama às 22:40 de Luanda com "Authorization: Bearer <CRON_SECRET>"):
 * - resumo do dia para cada artista: "Hoje ganhaste X Kz com Y desbloqueios 🔥";
 * - apaga os vídeos e capas de séries retiradas há mais de 30 dias (os registos de dinheiro ficam).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const released = await releaseDuePending(db);
  // "🎉 Ganhaste 5.000 Kz! Já podes levantar." para quem completou um bloco disponível
  for (const a of await db.artistProfile.findMany({ where: { status: "APPROVED" }, select: { id: true } })) await checkAvailableBlocks(db, a.id).catch(() => {});
  const summaries = await sendDailySummaries(db);
  const invites = await processPendingInvites(db);
  const purged = await purgeWithdrawnSeries(db, new Date(), (k) => deleteObject("media", k));
  return NextResponse.json({ released, summaries, invites, purged });
}
