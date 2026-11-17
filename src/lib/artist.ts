import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { requireUser } from "./auth";

/** Artista com sessão iniciada (redireciona se não for artista). */
export async function requireArtist(opts: { approved?: boolean } = {}) {
  const user = await requireUser("/artista");
  const artist = await db.artistProfile.findUnique({ where: { userId: user.id }, include: { payoutAccount: true } });
  if (!artist) redirect("/artista/registar");
  if (opts.approved && artist.status !== "APPROVED") redirect("/artista");
  return { user, artist };
}

export async function artistStats(artistId: string) {
  const [views, completions, sales, watch, gifts, visits, signups, payers] = await Promise.all([
    db.watchProgress.count({ where: { episode: { series: { artistId } } } }),
    db.watchProgress.count({ where: { completed: true, episode: { series: { artistId } } } }),
    db.paymentRequest.count({ where: { artistId, status: "CONFIRMED", kind: "EPISODE" } }),
    db.watchLog.aggregate({ where: { artistId }, _sum: { seconds: true } }),
    db.paymentRequest.aggregate({ where: { artistId, status: "CONFIRMED", kind: "GIFT" }, _count: true, _sum: { amountCents: true } }),
    db.referralVisit.aggregate({ where: { artistId }, _sum: { visits: true } }),
    db.user.count({ where: { referredByArtistId: artistId } }),
    db.user.count({ where: { referredByArtistId: artistId, paymentRequests: { some: { status: "CONFIRMED" } } } }),
  ]);
  return {
    views,
    completions,
    sales,
    minutes: Math.round((watch._sum.seconds ?? 0) / 60),
    gifts: gifts._count,
    giftsCents: gifts._sum.amountCents ?? 0,
    referral: { visits: visits._sum.visits ?? 0, signups, payers },
  };
}
