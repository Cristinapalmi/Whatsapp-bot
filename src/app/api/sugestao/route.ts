import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { resolveSuggestedSeries, todayLuanda } from "@/domain/suggestion";

/** GET: a série sugerida de hoje (ou nada, se a pessoa com conta já a viu hoje). */
export async function GET() {
  const user = await getCurrentUser();
  const today = todayLuanda();
  if (user?.suggestionSeenDay === today) return NextResponse.json({ series: null, today }, { headers: { "Cache-Control": "no-store" } });
  const s = await resolveSuggestedSeries(db);
  if (!s) return NextResponse.json({ series: null, today }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    {
      today,
      series: {
        slug: s.slug,
        title: s.title,
        synopsis: s.synopsis,
        freeEpisodes: s.freeEpisodes,
        coverUrl: await mediaUrl(s.coverKey),
        firstEpisodeId: s.episodes[0]?.id ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST: marca que a pessoa com conta já viu a sugestão hoje (em qualquer aparelho). */
export async function POST() {
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { suggestionSeenDay: todayLuanda() } });
  return NextResponse.json({ ok: true });
}
