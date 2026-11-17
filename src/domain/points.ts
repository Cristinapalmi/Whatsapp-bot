import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { business } from "@config/business";
import { UserFacingError } from "./errors";
import type { Tx } from "./money/ledger";

/**
 * PONTOS DE FÃ — regras:
 *  - +10 pontos por episódio visto até ao fim (só uma vez por episódio).
 *  - 100 pontos = 1 episódio grátis.
 *  - Os pontos NÃO têm valor em dinheiro: nunca entram no livro-razão, e um episódio
 *    desbloqueado com pontos NÃO gera pagamento ao artista.
 *  - Fãs ganham prémios (destaque "Fã n.º 1"), nunca dinheiro.
 */

export async function pointsBalance(db: Tx, userId: string) {
  const agg = await db.pointsTransaction.aggregate({ where: { userId }, _sum: { delta: true } });
  return agg._sum.delta ?? 0;
}

/** Dá os pontos de um episódio visto até ao fim. Devolve true se deu pontos agora. */
export async function awardCompletionPoints(db: Tx, userId: string, episodeId: string, artistId: string) {
  try {
    await db.pointsTransaction.create({
      data: { userId, episodeId, artistId, delta: business.points.perCompletedEpisode, reason: "EPISODE_COMPLETED" },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; // já tinha recebido
    throw e;
  }
}

/** Desbloqueia um episódio pago gastando pontos. */
export async function redeemEpisodeWithPoints(db: PrismaClient, { userId, episodeId }: { userId: string; episodeId: string }) {
  const cost = business.points.costPerEpisode;
  return db.$transaction(async (tx) => {
    // Bloqueio por utilizador: impede gastar os mesmos pontos duas vezes em simultâneo.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const episode = await tx.episode.findUnique({ where: { id: episodeId }, include: { series: true } });
    if (!episode || !episode.published || episode.series.status !== "PUBLISHED") throw new UserFacingError("Episódio não encontrado.");
    if (episode.number <= episode.series.freeEpisodes) throw new UserFacingError("Este episódio é grátis.");
    if (await tx.entitlement.findUnique({ where: { userId_episodeId: { userId, episodeId } } }))
      throw new UserFacingError("Já desbloqueaste este episódio.");
    const bal = await pointsBalance(tx, userId);
    if (bal < cost) throw new UserFacingError(`Precisas de ${cost} pontos. Tens ${bal}.`, "INSUFFICIENT_POINTS");
    await tx.pointsTransaction.create({
      data: { userId, episodeId, artistId: episode.series.artistId, delta: -cost, reason: "REDEEM_EPISODE" },
    });
    return tx.entitlement.create({ data: { userId, episodeId, source: "POINTS" } });
  });
}

/** Fãs com mais pontos ganhos a ver as séries de um artista ("Fã n.º 1" = o primeiro). */
export async function topFans(db: Tx, artistId: string, limit = 5) {
  const rows = await db.pointsTransaction.groupBy({
    by: ["userId"],
    where: { artistId, reason: "EPISODE_COMPLETED" },
    _sum: { delta: true },
    _min: { createdAt: true },
    orderBy: [{ _sum: { delta: "desc" } }, { _min: { createdAt: "asc" } }],
    take: limit,
  });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
  const byId = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ userId: r.userId, displayName: publicName(byId.get(r.userId) ?? "Fã"), points: r._sum.delta ?? 0 }));
}

/** Nome público discreto: "Joana M." (privacidade). */
export function publicName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}
