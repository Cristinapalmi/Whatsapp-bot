import type { Tx } from "../money/ledger";
import { getInts } from "../settings";

/**
 * OFERTA DE BOAS-VINDAS — regras:
 *  - Só para quem nunca comprou moedas (nenhuma compra confirmada nem pendente).
 *  - O pacote de 1.000 Kz (editável) dá moedas extra (ex.: 100 + 50).
 *  - Conta 24 h (editável) a partir da 1.ª vez que a oferta é mostrada. A hora fica guardada
 *    no servidor e nunca recomeça.
 *  - As moedas extra contam no valor real: o lote vale o que a pessoa pagou, dividido por todas as moedas.
 */
export type WelcomeOffer = { packId: string; priceKz: number; coins: number; bonusCoins: number; expiresAt: Date | null };

async function eligible(db: Tx, userId: string) {
  const bought = await db.paymentRequest.count({ where: { userId, kind: "COINS", status: { in: ["PENDING", "CONFIRMED", "REVERSED"] } } });
  return bought === 0;
}

/** A oferta para este utilizador (sem a começar). null = não tem direito ou já acabou. */
export async function welcomeOffer(db: Tx, user: { id: string; welcomeOfferStartedAt: Date | null } | null, now = new Date()): Promise<WelcomeOffer | null> {
  if (!user) return null;
  const cfg = await getInts(db, ["welcomePackKz", "welcomeBonusCoins", "welcomeOfferHours"]);
  const expiresAt = user.welcomeOfferStartedAt ? new Date(user.welcomeOfferStartedAt.getTime() + cfg.welcomeOfferHours * 3600_000) : null;
  if (expiresAt && expiresAt <= now) return null;
  const pack = await db.coinPack.findFirst({ where: { active: true, priceKz: cfg.welcomePackKz } });
  if (!pack) return null;
  if (!(await eligible(db, user.id))) return null;
  return { packId: pack.id, priceKz: pack.priceKz, coins: pack.coins, bonusCoins: cfg.welcomeBonusCoins, expiresAt };
}

/** Começa a contagem (1.ª vez que a oferta aparece). Nunca recomeça. */
export async function startWelcomeOffer(db: Tx, userId: string, now = new Date()) {
  await db.user.updateMany({ where: { id: userId, welcomeOfferStartedAt: null }, data: { welcomeOfferStartedAt: now } });
  const u = await db.user.findUnique({ where: { id: userId }, select: { id: true, welcomeOfferStartedAt: true } });
  return welcomeOffer(db, u, now);
}

/** Mostra a oferta (e começa a contagem, se for a 1.ª vez). */
export async function showWelcomeOffer(db: Tx, user: { id: string; welcomeOfferStartedAt: Date | null } | null, now = new Date()) {
  const offer = await welcomeOffer(db, user, now);
  if (!offer || offer.expiresAt || !user) return offer;
  return startWelcomeOffer(db, user.id, now);
}
