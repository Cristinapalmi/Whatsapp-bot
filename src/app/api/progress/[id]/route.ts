import { isSameOrigin } from "@/lib/origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canWatch, episodeStates, hasActivePass } from "@/domain/access";
import { dayLuanda } from "@/lib/dates";
import { awardCompletionPoints } from "@/domain/points";
import { onInviteeCompletion } from "@/domain/fans/invites";
import { business } from "@config/business";

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
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
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
  // "Visto até ao fim" = chegou aos 90% E viu de facto pelo menos 60% do tempo (não vale saltar para o fim).
  const totalWatched = (existing?.secondsWatched ?? 0) + seconds;
  const completed =
    parsed.data.completed &&
    (episode.durationSec === 0 || (parsed.data.position >= episode.durationSec * 0.9 && totalWatched >= episode.durationSec * 0.6));
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
      where: { day_userId_episodeId_viaPass: { day: dayLuanda(), userId: user.id, episodeId: id, viaPass } },
      create: { day: dayLuanda(), userId: user.id, episodeId: id, artistId: episode.series.artistId, seconds, viaPass },
      update: { seconds: { increment: seconds } },
    });
  }
  // Pontos de fã (sem valor em dinheiro): +10 na primeira vez que vê o episódio até ao fim
  const pointsAwarded = firstCompletion ? await awardCompletionPoints(db, user.id, id, episode.series.artistId) : false;
  // Convites de fãs: o amigo viu um episódio inteiro (tempo validado aqui no servidor)
  if (firstCompletion) await onInviteeCompletion(db, user.id).catch((e) => console.error("convite", e));
  return NextResponse.json({ ok: true, firstCompletion, points: pointsAwarded ? business.points.perCompletedEpisode : 0 });
}
