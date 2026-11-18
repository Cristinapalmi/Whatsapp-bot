import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { business } from "@config/business";
import { UserFacingError } from "../errors";
import { PLATFORM_REVENUE, adPool, artistAvailable, artistPending } from "../money/accounts";
import { balance, lockAccount, pendingUntil, postEntry, type Tx } from "../money/ledger";
import { distributePassPool, splitRevenue } from "../money/split";
import { getSettingInt } from "../coins/service";
import { monthRange } from "../ranking";
import { notify, audit } from "../notify";
import { AD_PROVIDERS } from "./provider";
import { formatKz } from "@/lib/money";

/**
 * DESBLOQUEAR 1 EPISÓDIO COM ANÚNCIO — oferta única por conta e por telefone.
 *  - Só com conta iniciada.
 *  - O anúncio tem de ser visto até ao fim: o servidor mede o tempo entre o início e o fim.
 *  - Nunca há desbloqueio duplo (transação + bloqueio por telefone).
 *  - Estes desbloqueios não geram pagamento na hora: contam para o FUNDO MENSAL DE ANÚNCIOS.
 *    Quando a administração regista receita de anúncios de um mês, a parte dos artistas vai
 *    para o fundo desse mês e é dividida pelos episódios desbloqueados por anúncio nesse mês.
 */

export const AD_OFFER_LIMIT_KEY = "adOfferLimit";
/** Margem para atrasos de rede ao medir o tempo do anúncio (segundos). */
const TIME_TOLERANCE_SEC = 1.5;
/** Máximo de anúncios começados e não terminados por hora (anti-batota). */
const MAX_OPEN_VIEWS_PER_HOUR = 6;

export const adOfferLimit = (db: Tx) => getSettingInt(db, AD_OFFER_LIMIT_KEY, 1);

/** "2026-11" — mês em Luanda. */
export const monthKeyLuanda = (d = new Date()) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 7);
export const nextMonthKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

export async function adOfferStatus(db: Tx, user: { id: string; phone: string }) {
  const [limit, used] = await Promise.all([
    adOfferLimit(db),
    db.adUnlock.count({ where: { OR: [{ userId: user.id }, { phone: user.phone }] } }),
  ]);
  return { limit, used, available: used < limit };
}

async function assertEpisodeLocked(db: Tx, userId: string, episodeId: string) {
  const episode = await db.episode.findUnique({ where: { id: episodeId }, include: { series: true } });
  if (!episode || !episode.published || episode.series.status !== "PUBLISHED") throw new UserFacingError("Episódio não encontrado.");
  if (episode.number <= episode.series.freeEpisodes) throw new UserFacingError("Este episódio é grátis.");
  if (await db.entitlement.findUnique({ where: { userId_episodeId: { userId, episodeId } } }))
    throw new UserFacingError("Já desbloqueaste este episódio.", "ALREADY_UNLOCKED");
  return episode;
}

/** Começa a ver um anúncio para desbloquear um episódio. */
export async function startAdView(db: PrismaClient, { userId, episodeId, now = new Date() }: { userId: string; episodeId: string; now?: Date }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const status = await adOfferStatus(db, user);
  if (!status.available) throw new UserFacingError("Já usaste a tua oferta de episódio grátis com anúncio.", "OFFER_USED");
  await assertEpisodeLocked(db, userId, episodeId);
  const open = await db.adView.count({ where: { userId, completedAt: null, startedAt: { gte: new Date(now.getTime() - 3600_000) } } });
  if (open >= MAX_OPEN_VIEWS_PER_HOUR) throw new UserFacingError("Demasiadas tentativas. Tenta mais tarde.", "RATE_LIMIT");

  let creative = null;
  for (const p of AD_PROVIDERS) {
    creative = await p.pickAd(db, now);
    if (creative) break;
  }
  if (!creative) throw new UserFacingError("Não há anúncios disponíveis agora. Tenta mais tarde.", "NO_ADS");

  const view = await db.adView.create({ data: { adId: creative.adId, userId, episodeId, startedAt: now } });
  await db.ad.update({ where: { id: creative.adId }, data: { impressions: { increment: 1 } } });
  return { view, creative };
}

/** Termina o anúncio: se o tempo for válido e a oferta ainda estiver livre, desbloqueia o episódio. */
export async function completeAdView(db: PrismaClient, { userId, viewId, now = new Date() }: { userId: string; viewId: string; now?: Date }) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    // Bloqueio por telefone: duas abas/dois aparelhos não conseguem usar a oferta duas vezes
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ad-offer:" + user.phone}))`;
    const view = await tx.adView.findUnique({ where: { id: viewId }, include: { ad: true, episode: { include: { series: true } } } });
    if (!view || view.userId !== userId) throw new UserFacingError("Anúncio inválido.");
    if (view.completedAt) throw new UserFacingError("Este anúncio já foi usado.", "ALREADY_USED");
    const elapsed = (now.getTime() - view.startedAt.getTime()) / 1000;
    if (elapsed + TIME_TOLERANCE_SEC < view.ad.durationSec)
      throw new UserFacingError("O anúncio tem de ser visto até ao fim.", "TOO_SOON");

    const status = await adOfferStatus(tx, user);
    if (!status.available) throw new UserFacingError("Já usaste a tua oferta de episódio grátis com anúncio.", "OFFER_USED");
    await assertEpisodeLocked(tx, userId, view.episodeId);

    await tx.adView.update({ where: { id: view.id }, data: { completedAt: now } });
    await tx.ad.update({ where: { id: view.adId }, data: { completions: { increment: 1 } } });
    const unlock = await tx.adUnlock.create({
      data: {
        userId,
        phone: user.phone,
        episodeId: view.episodeId,
        artistId: view.episode.series.artistId,
        adViewId: view.id,
        month: monthKeyLuanda(now),
      },
    });
    await tx.entitlement.create({ data: { userId, episodeId: view.episodeId, source: "AD" } });
    return unlock;
  });
}

/**
 * Regista receita de anúncios de um mês (ex.: o que um patrocinador pagou).
 * A parte dos artistas fica no fundo desse mês, à espera da divisão.
 */
export async function registerAdRevenue(
  db: PrismaClient,
  { month, amountCents, sponsor, description, adminId }: { month: string; amountCents: number; sponsor?: string; description?: string; adminId: string },
) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new UserFacingError("Mês inválido (AAAA-MM).");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new UserFacingError("Valor inválido.");
  return db.$transaction(async (tx) => {
    const { artistCents, platformCents } = splitRevenue(amountCents, 0, business.artistSharePercent);
    const rev = await tx.adRevenue.create({ data: { month, amountCents, sponsor: sponsor || null, description: description || null, createdById: adminId } });
    await postEntry(tx, {
      kind: "AD_REVENUE",
      description: `Receita de anúncios ${month}${sponsor ? ` — ${sponsor}` : ""}`,
      idempotencyKey: `ad-revenue:${rev.id}`,
      createdById: adminId,
      lines: [
        { account: { code: "platform:cash", name: "Caixa da plataforma", type: "ASSET" }, amountCents },
        { account: PLATFORM_REVENUE, amountCents: -platformCents },
        { account: adPool(month), amountCents: -artistCents },
      ],
    });
    await audit(tx, adminId, "AD_REVENUE_REGISTERED", "AdRevenue", rev.id, { month, amountCents });
    return rev;
  });
}

/**
 * Divide o fundo de anúncios de um mês JÁ TERMINADO pelos artistas, proporcionalmente aos
 * episódios deles desbloqueados por anúncio nesse mês. Restos de arredondamento → plataforma.
 * Se não houve desbloqueios por anúncio, o fundo passa para o mês seguinte.
 */
export async function distributeAdPool(db: PrismaClient, { month, adminId, now = new Date() }: { month: string; adminId: string | null; now?: Date }) {
  if (now < monthRange(month).to) throw new UserFacingError("Só se divide depois de o mês terminar.");
  const result = await db.$transaction(async (tx) => {
    await lockAccount(tx, adPool(month));
    const pool = await balance(tx, adPool(month));
    if (pool <= 0) throw new UserFacingError("Não há nada para dividir neste mês.");
    const counts = await tx.adUnlock.groupBy({ by: ["artistId"], where: { month }, _count: { _all: true } });
    const r = distributePassPool(pool, Object.fromEntries(counts.map((c) => [c.artistId, c._count._all])));
    const lines = [{ account: adPool(month), amountCents: pool }];
    // Os ganhos de anúncios também ficam pendentes X dias
    const until = await pendingUntil(tx, now);
    for (const [artistId, cents] of Object.entries(r.allocations)) lines.push({ account: until ? artistPending(artistId) : artistAvailable(artistId), amountCents: -cents });
    if (r.remainderCents) lines.push({ account: PLATFORM_REVENUE, amountCents: -r.remainderCents });
    if (r.rolloverCents) lines.push({ account: adPool(nextMonthKey(month)), amountCents: -r.rolloverCents });
    await postEntry(tx, {
      kind: r.rolloverCents ? "AD_ROLLOVER" : "AD_DISTRIBUTION",
      description: `Fundo de anúncios ${month}`,
      idempotencyKey: `ad-dist:${month}:${randomUUID()}`,
      availableAt: until,
      createdById: adminId ?? undefined,
      lines,
    });
    await audit(tx, adminId, "AD_POOL_DISTRIBUTED", "Month", month, { pool, ...r });
    return { month, pool, ...r };
  });
  for (const [artistId, cents] of Object.entries(result.allocations)) {
    const artist = await db.artistProfile.findUnique({ where: { id: artistId } });
    if (artist) await notify(db, artist.userId, "Ganhos com anúncios", `+${formatKz(cents)} dos episódios vistos com anúncio em ${month}.`, "/artista/carteira");
  }
  return result;
}
