import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { canWatch, episodeStates } from "@/domain/access";
import { pointsBalance } from "@/domain/points";
import { coinBalance, episodePriceCoins } from "@/domain/coins/service";
import { adOfferStatus } from "@/domain/ads/service";
import { houseAdProvider } from "@/domain/ads/provider";
import { IconChevronLeft, IconClock } from "@/components/icons";
import { UnlockPanel } from "@/components/UnlockPanel";
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
          artist: { select: { id: true, stageName: true, slug: true } },
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
  const [cover, points, balance, priceCoins, gifts] = await Promise.all([
    mediaUrl(series.coverKey),
    user ? pointsBalance(db, user.id) : 0,
    user ? coinBalance(db, user.id) : 0,
    episodePriceCoins(db, series),
    db.giftType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceCoins: "asc" }] }),
  ]);
  // Oferta única com anúncio: aparece se ainda estiver livre (ou para convidar a criar conta) e houver anúncios
  const adsAvailable = !!(await houseAdProvider.pickAd(db, new Date()));
  const adOffer = adsAvailable && (user ? (await adOfferStatus(db, user)).available : true);
  const adUnlocked = user
    ? (await db.entitlement.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId: episode.id } } }))?.source === "AD"
    : false;

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
          next={next ? { id: next.id, number: next.number, state: nextState! } : null}
          hasSubtitles={!!episode.subtitlesKey}
          artist={{ id: series.artist.id, slug: series.artist.slug, name: series.artist.stageName }}
          gifts={gifts.map((g) => ({ code: g.code, label: g.label, emoji: g.emoji, priceCoins: g.priceCoins }))}
          priceCoins={priceCoins}
          balance={balance}
          points={points}
          pointsCost={business.points.costPerEpisode}
          adOffer={adOffer}
          adUnlocked={adUnlocked}
        />
      ) : (
        <div className="relative mt-2 min-h-[220px] overflow-hidden rounded-2xl bg-surface sm:aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm" />}
          <div className="relative flex h-full min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
            {state === "pending" ? (
              <>
                <IconClock size={36} className="text-warn" />
                <p className="text-lg font-bold">Pagamento a aguardar confirmação</p>
                <p className="text-sm text-muted">Avisamos-te assim que for confirmado.</p>
                <Link href="/conta" className="btn-secondary">Ver os meus pedidos</Link>
              </>
            ) : (
              <>
                <p className="font-display text-xl font-extrabold text-accent2">Episódio {episode.number}</p>
                <UnlockPanel episodeId={episode.id} priceCoins={priceCoins} balance={balance} points={points} pointsCost={business.points.costPerEpisode} loggedIn={!!user} adOffer={adOffer} />
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
