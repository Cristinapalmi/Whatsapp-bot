import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { formatKz } from "@/lib/money";
import { canWatch, episodeStates } from "@/domain/access";
import { pointsBalance } from "@/domain/points";
import { business } from "@config/business";
import { kzToCents } from "@/lib/money";
import { IconChevronLeft, IconClock, IconLock } from "@/components/icons";
import { Player } from "./Player";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "A ver" };

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = await db.episode.findFirst({
    where: { id, published: true, series: { status: "PUBLISHED" } },
    include: {
      series: {
        include: {
          artist: { select: { stageName: true, slug: true } },
          episodes: { where: { published: true }, orderBy: { number: "asc" }, select: { id: true, number: true, title: true } },
        },
      },
    },
  });
  if (!episode) notFound();
  const { series } = episode;
  const user = await getCurrentUser();
  const states = await episodeStates(db, user?.id ?? null, series, series.episodes);
  const state = states[episode.id];
  const next = series.episodes.find((e) => e.number === episode.number + 1) ?? null;
  const nextState = next ? states[next.id] : null;
  const cover = await mediaUrl(series.coverKey);
  const points = user ? await pointsBalance(db, user.id) : 0;
  const passPrice = formatKz(kzToCents(business.weeklyPassPriceKz));

  return (
    <div className="container-app max-w-3xl">
      <Link href={`/serie/${series.slug}`} className="btn-ghost btn-sm -ml-3 text-muted">
        <IconChevronLeft size={18} /> {series.title}
      </Link>

      {canWatch(state) ? (
        <Player
          episodeId={episode.id}
          poster={cover}
          loggedIn={!!user}
          isLastFree={episode.number === series.freeEpisodes}
          endsWithHook={episode.endsWithHook}
          hookText={episode.hookText}
          next={next ? { id: next.id, number: next.number, state: nextState!, price: formatKz(series.priceCents) } : null}
          hasSubtitles={!!episode.subtitlesKey}
          artist={{ slug: series.artist.slug, name: series.artist.stageName }}
          passPrice={passPrice}
          gifts={business.gifts.map((g) => ({ id: g.id, label: g.label, price: formatKz(kzToCents(g.priceKz)) }))}
          points={points}
          pointsCost={business.points.costPerEpisode}
        />
      ) : (
        <div className="relative mt-2 aspect-video overflow-hidden rounded-2xl bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm" />}
          <div className="relative flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            {state === "pending" ? (
              <>
                <IconClock size={36} className="text-warn" />
                <p className="text-lg font-bold">Pagamento a aguardar confirmação</p>
                <p className="text-sm text-muted">Avisamos-te assim que for confirmado.</p>
                <Link href="/conta" className="btn-secondary">Ver os meus pedidos</Link>
              </>
            ) : (
              <>
                <IconLock size={36} className="text-accent" />
                <p className="text-lg font-bold">Este episódio custa {formatKz(series.priceCents)}</p>
                <Link href={user ? `/pagar?episodio=${episode.id}` : `/entrar?next=${encodeURIComponent(`/pagar?episodio=${episode.id}`)}`} className="btn-primary">
                  Desbloquear por {formatKz(series.priceCents)}
                </Link>
                <Link href={user ? "/pagar?passe=1" : `/entrar?next=${encodeURIComponent("/pagar?passe=1")}`} className="btn-secondary">
                  Ativa o passe semanal · {passPrice}
                </Link>
                {points >= business.points.costPerEpisode && (
                  <Link href={`/pagar?episodio=${episode.id}`} className="text-sm font-semibold text-accent2 underline">Usar {business.points.costPerEpisode} dos teus {points} pontos</Link>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm text-muted">Episódio {episode.number} · {series.artist.stageName}</p>
        <h1 className="text-2xl font-bold">{episode.title}</h1>
        {episode.synopsis && <p className="mt-2 text-fg/90">{episode.synopsis}</p>}
      </div>
    </div>
  );
}
