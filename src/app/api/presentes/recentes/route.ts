import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicName } from "@/domain/points";

/** Presentes recentes para um artista (para a animação por cima do vídeo). Só nome curto e o presente. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const artistId = u.searchParams.get("artista") ?? "";
  const since = new Date(Number(u.searchParams.get("desde")) || Date.now() - 60_000);
  if (!artistId) return NextResponse.json({ gifts: [] });
  const spends = await db.coinSpend.findMany({
    where: { artistId, kind: "GIFT", reversedAt: null, createdAt: { gt: new Date(Math.max(since.getTime(), Date.now() - 10 * 60_000)) } },
    orderBy: { createdAt: "asc" },
    take: 10,
    include: { user: { select: { name: true } } },
  });
  const types = await db.giftType.findMany({ where: { code: { in: spends.map((s) => s.giftCode ?? "") } } });
  const byCode = new Map(types.map((t) => [t.code, t]));
  return NextResponse.json(
    {
      now: Date.now(),
      gifts: spends.map((s) => ({ id: s.id, at: s.createdAt.getTime(), name: publicName(s.user.name), emoji: byCode.get(s.giftCode ?? "")?.emoji ?? "🎁", label: byCode.get(s.giftCode ?? "")?.label ?? "Presente" })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
