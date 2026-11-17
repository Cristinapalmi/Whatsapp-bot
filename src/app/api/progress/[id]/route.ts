import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canWatch, episodeStates, hasActivePass } from "@/domain/access";
import { dayUtc } from "@/lib/dates";

const schema = z.object({
  seconds: z.number().int().min(0).max(600),
  position: z.number().int().min(0).max(36000),
  completed: z.boolean().default(false),
});

/**
 * Regista segundos vistos. Proteções contra batota:
 * - nunca aceita mais de 30 s por envio (o leitor envia a cada 15 s);
 * - o total por episódio não ultrapassa 3× a duração do episódio.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const episode = await db.episode.findUnique({ where: { id }, include: { series: true } });
  if (!episode) return NextResponse.json({ ok: false }, { status: 404 });
  const states = await episodeStates(db, user.id, episode.series, [episode]);
  if (!canWatch(states[id])) return NextResponse.json({ ok: false }, { status: 403 });

  const existing = await db.watchProgress.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId: id } } });
  const cap = Math.max(60, episode.durationSec * 3);
  const seconds = Math.min(parsed.data.seconds, 30, Math.max(0, cap - (existing?.secondsWatched ?? 0)));
  const completed = parsed.data.completed && (episode.durationSec === 0 || parsed.data.position >= episode.durationSec * 0.9);
  const firstCompletion = completed && !existing?.completed;

  await db.watchProgress.upsert({
    where: { userId_episodeId: { userId: user.id, episodeId: id } },
    create: { userId: user.id, episodeId: id, secondsWatched: seconds, lastPosition: parsed.data.position, completed, completedAt: completed ? new Date() : null },
    update: {
      secondsWatched: { increment: seconds },
      lastPosition: parsed.data.position,
      ...(firstCompletion ? { completed: true, completedAt: new Date() } : {}),
    },
  });

  if (seconds > 0) {
    const viaPass = episode.number > episode.series.freeEpisodes && (await hasActivePass(db, user.id));
    await db.watchLog.upsert({
      where: { day_userId_episodeId_viaPass: { day: dayUtc(), userId: user.id, episodeId: id, viaPass } },
      create: { day: dayUtc(), userId: user.id, episodeId: id, artistId: episode.series.artistId, seconds, viaPass },
      update: { seconds: { increment: seconds } },
    });
  }
  return NextResponse.json({ ok: true, firstCompletion });
}
