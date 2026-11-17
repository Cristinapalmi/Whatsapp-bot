import type { Episode, Series } from "@prisma/client";
import type { Tx } from "./money/ledger";

/**
 * Estado de cada episódio para um utilizador:
 *  free      → grátis (dentro dos primeiros N episódios)
 *  unlocked  → desbloqueado (pagou, pontos, ou passe ativo)
 *  pending   → pagamento enviado, a aguardar confirmação
 *  locked    → tem de pagar
 */
export type EpisodeState = "free" | "unlocked" | "pending" | "locked";

export async function hasActivePass(db: Tx, userId: string, at = new Date()) {
  const pass = await db.weeklyPass.findFirst({
    where: { userId, revokedAt: null, startsAt: { lte: at }, endsAt: { gt: at } },
  });
  return !!pass;
}

export async function episodeStates(
  db: Tx,
  userId: string | null,
  series: Pick<Series, "freeEpisodes">,
  episodes: Pick<Episode, "id" | "number">[],
): Promise<Record<string, EpisodeState>> {
  const ids = episodes.map((e) => e.id);
  const [ents, pending, pass] = userId
    ? await Promise.all([
        db.entitlement.findMany({ where: { userId, episodeId: { in: ids } }, select: { episodeId: true } }),
        db.paymentRequest.findMany({ where: { userId, status: "PENDING", episodeId: { in: ids } }, select: { episodeId: true } }),
        hasActivePass(db, userId),
      ])
    : [[], [], false];
  const entSet = new Set(ents.map((e) => e.episodeId));
  const pendSet = new Set(pending.map((p) => p.episodeId));
  const out: Record<string, EpisodeState> = {};
  for (const e of episodes) {
    if (e.number <= series.freeEpisodes) out[e.id] = "free";
    else if (entSet.has(e.id) || pass) out[e.id] = "unlocked";
    else if (pendSet.has(e.id)) out[e.id] = "pending";
    else out[e.id] = "locked";
  }
  return out;
}

export const canWatch = (s: EpisodeState) => s === "free" || s === "unlocked";
