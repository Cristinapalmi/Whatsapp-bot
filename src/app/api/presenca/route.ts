import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin";
import { claimDailyPresence } from "@/domain/fans/presence";

/** Pontos de presença do dia (uma vez por dia; o servidor garante). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false });
  const r = await claimDailyPresence(db, user.id);
  return NextResponse.json({ ok: true, ...(r ?? {}) }, { headers: { "Cache-Control": "no-store" } });
}
