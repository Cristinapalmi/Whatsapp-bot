import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canWatch, episodeStates } from "@/domain/access";
import { watchableSeriesWhere } from "@/domain/series-workflow";
import { getPlaybackUrl, getSubtitlesUrl } from "@/domain/video";

/** Devolve o link temporário do vídeo — só se o utilizador tiver direito a ver. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams.get("q") === "medium" ? "medium" : "low";
  const episode = await db.episode.findFirst({
    where: { id, published: true, series: watchableSeriesWhere() },
    include: { series: true },
  });
  if (!episode) return NextResponse.json({ error: "Episódio não encontrado." }, { status: 404 });
  const user = await getCurrentUser();
  // Conta obrigatória para ver qualquer episódio (os 3 primeiros continuam grátis, mas só com conta)
  if (!user) return NextResponse.json({ error: "Cria a tua conta grátis para ver.", code: "LOGIN" }, { status: 401 });
  const states = await episodeStates(db, user?.id ?? null, episode.series, [episode]);
  // Série retirada: só quem desbloqueou (os grátis também deixam de estar abertos a todos)
  const st = states[episode.id];
  if (episode.series.status !== "PUBLISHED" && st !== "unlocked") return NextResponse.json({ error: "Esta série foi retirada." }, { status: 403 });
  if (!canWatch(st)) return NextResponse.json({ error: "Episódio bloqueado." }, { status: 403 });
  const url = await getPlaybackUrl(episode, q);
  if (!url) return NextResponse.json({ error: "Vídeo ainda não disponível." }, { status: 404 });
  return NextResponse.json({ url, subtitles: await getSubtitlesUrl(episode) }, { headers: { "Cache-Control": "no-store" } });
}
