import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { episodeStates } from "@/domain/access";
import { pointsBalance } from "@/domain/points";
import { coinBalance, episodePriceCoins } from "@/domain/coins/service";
import { adOfferStatus } from "@/domain/ads/service";
import { houseAdProvider } from "@/domain/ads/provider";
import { ReelPlayer } from "./ReelPlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ep = await db.episode.findUnique({ where: { id: (await params).id }, select: { number: true, series: { select: { title: true } } } });
  return { title: ep ? `${ep.series.title} · Ep. ${ep.number}` : "A ver" };
}

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = await db.episode.findFirst({
    where: { id, published: true, series: { status: "PUBLISHED" } },
    include: {
      series: {
        include: {
          artist: { select: { id: true, stageName: true, slug: true } },
          episodes: {
            where: { published: true },
            orderBy: { number: "asc" },
            select: { id: true, number: true, title: true, endsWithHook: true, hookText: true },
          },
        },
      },
    },
  });
  if (!episode) notFound();
  const { series } = episode;
  const user = await getCurrentUser();

  const [states, cover, points, balance, priceCoins, gifts, fav, adEnts, ads] = await Promise.all([
    episodeStates(db, user?.id ?? null, series, series.episodes),
    mediaUrl(series.coverKey),
    user ? pointsBalance(db, user.id) : 0,
    user ? coinBalance(db, user.id) : 0,
    episodePriceCoins(db, series),
    db.giftType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceCoins: "asc" }] }),
    user ? db.favorite.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId: series.id } } }) : null,
    user ? db.entitlement.findMany({ where: { userId: user.id, source: "AD", episodeId: { in: series.episodes.map((e) => e.id) } }, select: { episodeId: true } }) : [],
    houseAdProvider.pickAd(db, new Date()),
  ]);
  // Oferta única com anúncio: só se ainda estiver livre (ou para convidar a criar conta) e houver anúncios
  const adOffer = !!ads && (user ? (await adOfferStatus(db, user)).available : true);

  return (
    <ReelPlayer
      series={{ id: series.id, slug: series.slug, title: series.title, freeEpisodes: series.freeEpisodes, coverUrl: cover }}
      artist={{ id: series.artist.id, slug: series.artist.slug, name: series.artist.stageName }}
      episodes={series.episodes.map((e) => ({ ...e, state: states[e.id] }))}
      initialIndex={Math.max(0, series.episodes.findIndex((e) => e.id === episode.id))}
      priceCoins={priceCoins}
      balance={balance}
      points={points}
      pointsCost={business.points.costPerEpisode}
      adOffer={adOffer}
      adUnlockedIds={adEnts.map((e) => e.episodeId)}
      isFavorite={!!fav}
      loggedIn={!!user}
      gifts={gifts.map((g) => ({ code: g.code, label: g.label, emoji: g.emoji, priceCoins: g.priceCoins }))}
    />
  );
}
