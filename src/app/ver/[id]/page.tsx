import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { episodeStates } from "@/domain/access";
import { pointsBalance } from "@/domain/points";
import { coinBalance, episodePriceCoins, packBonusPercent, seasonOffer } from "@/domain/coins/service";
import { welcomeOffer } from "@/domain/coins/welcome";
import { manualProvider } from "@/domain/payments/providers/manual";
import { formatPhone } from "@/lib/phone";
import { siteUrl } from "@config/brand";
import { ensureInviteCode } from "@/domain/fans/invites";
import { publicName } from "@/domain/points";
import { adOfferStatus } from "@/domain/ads/service";
import { houseAdProvider } from "@/domain/ads/provider";
import { watchableSeriesWhere, withdrawnUntil } from "@/domain/series-workflow";
import { formatDate } from "@/lib/dates";
import { AuthWall } from "@/components/AuthWall";
import { ReelPlayer } from "./ReelPlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ep = await db.episode.findUnique({ where: { id: (await params).id }, select: { number: true, series: { select: { title: true } } } });
  return { title: ep ? `${ep.series.title} · Ep. ${ep.number}` : "A ver" };
}

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = await db.episode.findFirst({
    where: { id, published: true, series: watchableSeriesWhere() },
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
  // Conta obrigatória para ver (incluindo os episódios grátis)
  if (!user) {
    const cover = await mediaUrl(series.coverKey);
    return <AuthWall next={`/ver/${episode.id}`} title={series.title} episode={episode.number} coverUrl={cover} backHref={`/serie/${series.slug}`} />;
  }

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
  const [season, packs, welcome, pendingPayment, instructions] = await Promise.all([
    seasonOffer(db, user?.id ?? null, series),
    db.coinPack.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceKz: "asc" }] }),
    welcomeOffer(db, user),
    user ? db.paymentRequest.count({ where: { userId: user.id, kind: "COINS", status: "PENDING" } }) : 0,
    manualProvider.initiate({ paymentRequestId: "", amountCents: 0, description: "" }),
  ]);
  const inviteCode = user ? await ensureInviteCode(db, user.id) : null;
  const basePack = packs.reduce((a, pk) => (pk.priceKz < a.priceKz ? pk : a), packs[0] ?? { priceKz: 1, coins: 1 });
  // Oferta única com anúncio: só se ainda estiver livre (ou para convidar a criar conta) e houver anúncios
  // Série retirada pelo artista: só ficam os episódios desbloqueados, até ao fim do prazo
  const withdrawn = series.status !== "PUBLISHED" && series.withdrawnAt ? withdrawnUntil(series.withdrawnAt) : null;
  if (withdrawn) {
    for (const e of series.episodes) if (states[e.id] !== "unlocked") states[e.id] = "locked";
    if (!user || !Object.values(states).includes("unlocked")) notFound();
  }
  const adOffer = !withdrawn && !!ads && (user ? (await adOfferStatus(db, user)).available : true);

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
      season={withdrawn ? null : season}
      packs={packs.map((pk) => ({ id: pk.id, priceKz: pk.priceKz, coins: pk.coins, bonusPercent: packBonusPercent(pk, basePack) }))}
      welcome={welcome ? { packId: welcome.packId, bonusCoins: welcome.bonusCoins, expiresAt: welcome.expiresAt?.toISOString() ?? null } : null}
      payLines={instructions.type === "instructions" ? instructions.lines.filter((l) => l.label !== "Valor a transferir") : []}
      payerPhone={user ? formatPhone(user.phone) : ""}
      pendingPayment={pendingPayment > 0}
      shareUrl={`${siteUrl()}/serie/${series.slug}${inviteCode ? `?amigo=${inviteCode}` : ""}`}
      viewerName={user ? publicName(user.name) : null}
      withdrawnNotice={withdrawn ? `Esta série foi retirada pelo artista. Podes ver os episódios que desbloqueaste até ${formatDate(withdrawn)}.` : null}
      gifts={withdrawn ? [] : gifts.map((g) => ({ code: g.code, label: g.label, emoji: g.emoji, priceCoins: g.priceCoins }))}
    />
  );
}
