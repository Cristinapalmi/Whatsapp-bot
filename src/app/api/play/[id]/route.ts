import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canWatch, episodeStates } from "@/domain/access";
import { getPlaybackUrl, getSubtitlesUrl } from "@/domain/video";

/** Devolve o link temporário do vídeo — só se o utilizador tiver direito a ver. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams.get("q") === "medium" ? "medium" : "low";
  const episode = await db.episode.findFirst({
    where: { id, published: true, series: { status: "PUBLISHED" } },
    include: { series: true },
  });
  if (!episode) return NextResponse.json({ error: "Episódio não encontrado." }, { status: 404 });
  const user = await getCurrentUser();
  const states = await episodeStates(db, user?.id ?? null, episode.series, [episode]);
  if (!canWatch(states[episode.id])) return NextResponse.json({ error: "Episódio bloqueado." }, { status: 403 });
  const url = await getPlaybackUrl(episode, q);
  if (!url) return NextResponse.json({ error: "Vídeo ainda não disponível." }, { status: 404 });
  return NextResponse.json({ url, subtitles: await getSubtitlesUrl(episode) }, { headers: { "Cache-Control": "no-store" } });
}
