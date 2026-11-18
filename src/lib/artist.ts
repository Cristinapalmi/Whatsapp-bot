import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { requireUser } from "./auth";
import { business } from "@config/business";

/** Artista com sessão iniciada (redireciona se não for artista). */
export async function requireArtist(opts: { approved?: boolean } = {}) {
  const user = await requireUser("/artista");
  const artist = await db.artistProfile.findUnique({ where: { userId: user.id }, include: { payoutAccount: true } });
  if (!artist) redirect("/artista/registar");
  if (opts.approved && artist.status !== "APPROVED") redirect("/artista");
  return { user, artist };
}

export async function artistStats(artistId: string) {
  const pct = business.artistSharePercent;
  const [views, completions, legacySales, coinSales, watch, legacyGifts, coinGifts, visits, signups, payers, recentSales, adUnlocks, adEarned] = await Promise.all([
    db.watchProgress.count({ where: { episode: { series: { artistId } } } }),
    db.watchProgress.count({ where: { completed: true, episode: { series: { artistId } } } }),
    db.paymentRequest.count({ where: { artistId, status: "CONFIRMED", kind: "EPISODE" } }),
    db.coinSpend.aggregate({ where: { artistId, kind: "EPISODE", reversedAt: null }, _count: true, _sum: { artistCents: true } }),
    db.watchLog.aggregate({ where: { artistId }, _sum: { seconds: true } }),
    db.paymentRequest.aggregate({ where: { artistId, status: "CONFIRMED", kind: "GIFT" }, _count: true, _sum: { amountCents: true } }),
    db.coinSpend.aggregate({ where: { artistId, kind: "GIFT", reversedAt: null }, _count: true, _sum: { artistCents: true } }),
    db.referralVisit.aggregate({ where: { artistId }, _sum: { visits: true } }),
    db.user.count({ where: { referredByArtistId: artistId } }),
    db.user.count({
      where: {
        referredByArtistId: artistId,
        OR: [{ paymentRequests: { some: { status: "CONFIRMED" } } }, { coinSpends: { some: { reversedAt: null } } }],
      },
    }),
    db.coinSpend.findMany({
      where: { artistId, reversedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { episode: { select: { number: true, series: { select: { title: true } } } } },
    }),
    db.adUnlock.count({ where: { artistId } }),
    db.ledgerLine.aggregate({ where: { account: { code: `artist:${artistId}:available` }, entry: { kind: "AD_DISTRIBUTION" } }, _sum: { amountCents: true } }),
  ]);
  return {
    views,
    completions,
    sales: legacySales + coinSales._count,
    minutes: Math.round((watch._sum.seconds ?? 0) / 60),
    gifts: legacyGifts._count + coinGifts._count,
    /** O que o ARTISTA ganhou com presentes (nunca a parte da plataforma). */
    giftsEarnedCents: Math.floor(((legacyGifts._sum.amountCents ?? 0) * pct) / 100) + (coinGifts._sum.artistCents ?? 0),
    referral: { visits: visits._sum.visits ?? 0, signups, payers },
    /** Episódios desbloqueados com anúncio e o que o ARTISTA ganhou com anúncios. */
    adUnlocks,
    adsEarnedCents: 0 - (adEarned._sum.amountCents ?? 0) || 0,
    recentSales: recentSales.map((s) => ({
      id: s.id,
      date: s.createdAt,
      text: s.kind === "EPISODE" && s.episode ? `${s.episode.series.title} — Ep. ${s.episode.number}` : "Presente",
      earnedCents: s.artistCents,
    })),
  };
}
