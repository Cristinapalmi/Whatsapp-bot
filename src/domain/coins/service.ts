import type { Prisma, PrismaClient } from "@prisma/client";
import { business } from "@config/business";
import { UserFacingError } from "../errors";
import { COINS_OUTSTANDING, PLATFORM_REVENUE, artistAvailable, artistPending } from "../money/accounts";
import { earningAccount, postEntry, type Tx } from "../money/ledger";
import { splitRevenue } from "../money/split";
import { notify } from "../notify";
import { formatKz } from "@/lib/money";
import { getInt, getInts } from "../settings";
import { afterArtistSale, artistShareFor } from "../artists/growth";

/**
 * MOEDAS — regras:
 *  - O fã compra um pacote (ex.: 1.000 Kz = 100 moedas). As moedas só entram depois de o
 *    admin confirmar o comprovativo. Cada compra é um "lote" que guarda o VALOR REAL pago.
 *  - Moedas compradas e não gastas NÃO são receita: ficam na conta "Moedas por gastar".
 *  - Ao gastar moedas (episódio ou presente), usam-se primeiro as mais antigas. O artista
 *    ganha a sua percentagem do valor real dessas moedas; o resto é da plataforma.
 *  - As moedas não têm prazo, não se transferem e nunca se convertem em dinheiro.
 */

export const DEFAULT_EPISODE_PRICE_COINS = 20;

export async function getSettingInt(db: Tx, key: string, fallback: number) {
  const row = await db.setting.findUnique({ where: { key } });
  const n = row ? Number.parseInt(row.value, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function setSetting(db: Tx, key: string, value: string) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/**
 * NÍVEIS DE PREÇO (editáveis em Admin → Moedas):
 *  - Entrada 10 moedas (todas as séries novas começam aqui);
 *  - Normal 20 moedas (sobe sozinha aos 100 desbloqueios pagos);
 *  - Premium 30 moedas (só o admin decide).
 * Os primeiros 3 episódios são sempre grátis.
 */
export type Tier = "ENTRY" | "NORMAL" | "PREMIUM";
export const TIER_LABELS: Record<Tier, string> = { ENTRY: "Entrada", NORMAL: "Normal ⭐", PREMIUM: "Premium 💎" };

export async function tierPrices(db: Tx): Promise<Record<Tier, number>> {
  const [v, legacy] = await Promise.all([
    getInts(db, ["tierPriceEntry", "tierPriceNormal", "tierPricePremium"]),
    db.setting.findMany({ where: { key: { in: ["tierPriceNormal", "episodePriceCoins"] } } }),
  ]);
  // compatibilidade: o antigo "preço por defeito" vale como Normal se o Normal nunca foi gravado
  const old = legacy.some((r) => r.key === "tierPriceNormal") ? null : Number.parseInt(legacy.find((r) => r.key === "episodePriceCoins")?.value ?? "", 10);
  return { ENTRY: v.tierPriceEntry, NORMAL: old && old > 0 ? old : v.tierPriceNormal, PREMIUM: v.tierPricePremium };
}

/** Preço de referência (nível Normal) — usado na loja para dizer "1 episódio ≈ X moedas". */
export const defaultEpisodePriceCoins = async (db: Tx) => (await tierPrices(db)).NORMAL;
export const tierUpgradeUnlocks = (db: Tx) => getInt(db, "tierUpgradeUnlocks");
export const seasonDiscountPercent = (db: Tx) => getInt(db, "seasonDiscountPercent");

/** Preço de um episódio em moedas, conforme o nível da série. */
export async function episodePriceCoins(db: Tx, series: { tier: Tier }) {
  return (await tierPrices(db))[series.tier];
}

/** Desbloqueios pagos com moedas de uma série (cada episódio de uma temporada conta). */
export const paidUnlocks = (db: Tx, seriesId: string) =>
  db.entitlement.count({ where: { source: "COINS", episode: { seriesId } } });

/** Sobe a série de Entrada para Normal quando chega aos desbloqueios pagos definidos (100). */
export async function maybeUpgradeTier(db: PrismaClient, seriesId: string) {
  const s = await db.series.findUnique({ where: { id: seriesId }, include: { artist: true } });
  if (!s || s.tier !== "ENTRY") return false;
  if ((await paidUnlocks(db, seriesId)) < (await tierUpgradeUnlocks(db))) return false;
  const r = await db.series.updateMany({ where: { id: seriesId, tier: "ENTRY" }, data: { tier: "NORMAL" } });
  if (r.count === 0) return false;
  await notify(db, s.artist.userId, "A tua série subiu de nível", `A tua série subiu para Normal ⭐! Agora ganhas mais por episódio.`, `/artista/series/${s.id}`);
  return true;
}

/**
 * Oferta "temporada": todos os episódios pagos que o fã ainda não tem, com desconto.
 * Só aparece se faltarem pelo menos 2 episódios.
 */
export async function seasonOffer(db: Tx, userId: string | null, series: { id: string; tier: Tier; freeEpisodes: number }) {
  const eps = await db.episode.findMany({
    where: { seriesId: series.id, published: true, number: { gt: series.freeEpisodes } },
    select: { id: true },
  });
  const owned = userId
    ? new Set((await db.entitlement.findMany({ where: { userId, episodeId: { in: eps.map((e) => e.id) } }, select: { episodeId: true } })).map((e) => e.episodeId))
    : new Set<string>();
  const episodeIds = eps.map((e) => e.id).filter((id) => !owned.has(id));
  if (episodeIds.length < 2) return null;
  const [unit, discountPercent] = await Promise.all([episodePriceCoins(db, series), seasonDiscountPercent(db)]);
  const fullPrice = unit * episodeIds.length;
  const price = Math.max(1, Math.round((fullPrice * (100 - discountPercent)) / 100));
  return { episodeIds, count: episodeIds.length, unit, fullPrice, price, discountPercent };
}

export async function coinBalance(db: Tx, userId: string) {
  const agg = await db.coinLot.aggregate({ where: { userId, revokedAt: null }, _sum: { coinsRemaining: true } });
  return agg._sum.coinsRemaining ?? 0;
}

/** Bónus de um pacote face ao pacote base (ex.: 220 moedas por 2.000 Kz = +10%). */
export function packBonusPercent(pack: { priceKz: number; coins: number }, base: { priceKz: number; coins: number }) {
  const baseRate = base.coins / base.priceKz;
  const expected = pack.priceKz * baseRate;
  return Math.max(0, Math.round(((pack.coins - expected) / expected) * 100));
}

const lockUser = (tx: Prisma.TransactionClient, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"coins:" + userId}))`;

/** Lote criado quando o admin confirma uma compra de moedas (chamado dentro da transação de confirmação). */
export async function creditCoinLot(
  tx: Prisma.TransactionClient,
  p: { id: string; userId: string; coins: number; netCents: number; adminId: string | null },
) {
  const lot = await tx.coinLot.create({
    data: { userId: p.userId, paymentRequestId: p.id, coinsTotal: p.coins, coinsRemaining: p.coins, valueCents: p.netCents, valueRemainingCents: p.netCents },
  });
  await postEntry(tx, {
    kind: "COINS_PURCHASED",
    description: `Compra de ${p.coins} moedas`,
    idempotencyKey: `payment:${p.id}:confirm`,
    paymentRequestId: p.id,
    createdById: p.adminId ?? undefined,
    lines: [
      { account: { code: "platform:cash", name: "Caixa da plataforma", type: "ASSET" }, amountCents: p.netCents },
      { account: COINS_OUTSTANDING, amountCents: -p.netCents },
    ],
  });
  await notify(tx, p.userId, "Moedas na tua carteira", `+${p.coins} moedas. Bom proveito!`, "/loja");
  return lot;
}

type SpendInput = {
  userId: string;
  coins: number;
  kind: "EPISODE" | "SEASON" | "GIFT";
  artistId: string;
  episodeId?: string;
  seriesId?: string;
  giftCode?: string;
  description: string;
};

/** Gasta moedas (primeiro as mais antigas) e regista o ganho do artista. Usar dentro de uma transação com o utilizador bloqueado. */
async function spendCoins(tx: Prisma.TransactionClient, input: SpendInput) {
  if (!Number.isInteger(input.coins) || input.coins <= 0) throw new UserFacingError("Preço inválido.");
  const lots = await tx.coinLot.findMany({
    where: { userId: input.userId, revokedAt: null, coinsRemaining: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });
  const balance = lots.reduce((a, l) => a + l.coinsRemaining, 0);
  if (balance < input.coins)
    throw new UserFacingError(`Precisas de ${input.coins} moedas. Tens ${balance}.`, "INSUFFICIENT_COINS");

  let need = input.coins;
  let value = 0;
  const allocations: { lotId: string; coins: number; valueCents: number }[] = [];
  for (const lot of lots) {
    if (need === 0) break;
    const take = Math.min(need, lot.coinsRemaining);
    // Valor exato: as últimas moedas do lote levam o resto, para não se perder nenhum cêntimo.
    const v = take === lot.coinsRemaining ? lot.valueRemainingCents : Math.floor((lot.valueRemainingCents * take) / lot.coinsRemaining);
    await tx.coinLot.update({
      where: { id: lot.id },
      data: { coinsRemaining: { decrement: take }, valueRemainingCents: { decrement: v } },
    });
    allocations.push({ lotId: lot.id, coins: take, valueCents: v });
    value += v;
    need -= take;
  }
  // Parte do artista (Artistas Fundadores ganham mais nos primeiros meses)
  const artist = await tx.artistProfile.findUniqueOrThrow({ where: { id: input.artistId }, select: { founderNumber: true, createdAt: true } });
  const { artistCents, platformCents } = splitRevenue(value, 0, await artistShareFor(tx, artist));
  const spend = await tx.coinSpend.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      episodeId: input.episodeId,
      seriesId: input.seriesId,
      giftCode: input.giftCode,
      artistId: input.artistId,
      coins: input.coins,
      valueCents: value,
      artistCents,
      allocations: { create: allocations },
    },
  });
  if (value > 0) {
    // O ganho do artista entra como PENDENTE (X dias, editável) e passa sozinho a disponível
    const earn = await earningAccount(tx, input.artistId);
    await postEntry(tx, {
      kind: input.kind === "GIFT" ? "COIN_SPEND_GIFT" : "COIN_SPEND_EPISODE",
      description: input.description,
      idempotencyKey: `coin-spend:${spend.id}`,
      availableAt: earn.availableAt,
      lines: [
        { account: COINS_OUTSTANDING, amountCents: value },
        { account: earn.account, amountCents: -artistCents },
        { account: PLATFORM_REVENUE, amountCents: -platformCents },
      ],
    });
  }
  return spend;
}

/** Desbloqueia um episódio com moedas (fica desbloqueado para sempre). */
export async function unlockEpisodeWithCoins(db: PrismaClient, { userId, episodeId }: { userId: string; episodeId: string }) {
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const episode = await tx.episode.findUnique({ where: { id: episodeId }, include: { series: { include: { artist: true } } } });
    if (!episode || !episode.published || episode.series.status !== "PUBLISHED") throw new UserFacingError("Episódio não encontrado.");
    if (episode.number <= episode.series.freeEpisodes) throw new UserFacingError("Este episódio é grátis.");
    // Proteção contra cliques repetidos / dois separadores: se já está desbloqueado, não cobra outra vez.
    if (await tx.entitlement.findUnique({ where: { userId_episodeId: { userId, episodeId } } }))
      throw new UserFacingError("Já desbloqueaste este episódio.", "ALREADY_UNLOCKED");
    const price = await episodePriceCoins(tx, episode.series);
    const spend = await spendCoins(tx, {
      userId,
      coins: price,
      kind: "EPISODE",
      artistId: episode.series.artistId,
      episodeId,
      seriesId: episode.seriesId,
      description: `Episódio ${episode.number} de "${episode.series.title}" (${price} moedas)`,
    });
    await tx.entitlement.create({ data: { userId, episodeId, source: "COINS", coinSpendId: spend.id } });
    return { spend, artistUserId: episode.series.artist.userId, seriesId: episode.seriesId, artistId: episode.series.artistId };
  });
  await afterPaidUnlock(db, result);
  return result.spend;
}

/** Desbloqueia de uma vez todos os episódios restantes da série, com desconto. Uma só cobrança. */
export async function unlockSeasonWithCoins(db: PrismaClient, { userId, seriesId }: { userId: string; seriesId: string }) {
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const series = await tx.series.findUnique({ where: { id: seriesId }, include: { artist: true } });
    if (!series || series.status !== "PUBLISHED") throw new UserFacingError("Série não encontrada.");
    // Calculado dentro da transação (com o fã bloqueado): nunca cobra duas vezes o mesmo episódio.
    const offer = await seasonOffer(tx, userId, series);
    if (!offer) throw new UserFacingError("Já tens todos os episódios desta série (ou falta só um).", "ALREADY_UNLOCKED");
    const spend = await spendCoins(tx, {
      userId,
      coins: offer.price,
      kind: "SEASON",
      artistId: series.artistId,
      seriesId,
      description: `Temporada de "${series.title}": ${offer.count} episódios (${offer.price} moedas, -${offer.discountPercent}%)`,
    });
    await tx.entitlement.createMany({
      data: offer.episodeIds.map((episodeId) => ({ userId, episodeId, source: "COINS" as const, coinSpendId: spend.id })),
      skipDuplicates: true,
    });
    return { spend, artistUserId: series.artist.userId, seriesId, count: offer.count, artistId: series.artistId };
  });
  await afterPaidUnlock(db, result);
  return result;
}

/**
 * Depois de um desbloqueio pago: talvez subir o nível da série, 1.ª venda, convite e marcos.
 * Não se avisa o artista a cada desbloqueio — recebe um resumo por dia.
 */
async function afterPaidUnlock(db: PrismaClient, r: { artistId: string; seriesId: string }) {
  await maybeUpgradeTier(db, r.seriesId).catch(() => {});
  await afterArtistSale(db, { artistId: r.artistId, seriesId: r.seriesId }).catch((e) => console.error("afterArtistSale", e));
}

/** Oferece um presente a um artista, pago com moedas. */
export async function sendGiftWithCoins(db: PrismaClient, { userId, artistId, giftCode }: { userId: string; artistId: string; giftCode: string }) {
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const gift = await tx.giftType.findUnique({ where: { code: giftCode } });
    if (!gift || !gift.active) throw new UserFacingError("Presente inválido.");
    const artist = await tx.artistProfile.findUnique({ where: { id: artistId } });
    if (!artist || artist.status !== "APPROVED") throw new UserFacingError("Artista não encontrado.");
    if (artist.userId === userId) throw new UserFacingError("Não podes oferecer presentes a ti próprio.");
    const spend = await spendCoins(tx, {
      userId,
      coins: gift.priceCoins,
      kind: "GIFT",
      artistId,
      giftCode: gift.code,
      description: `Presente ${gift.emoji} ${gift.label} para ${artist.stageName}`,
    });
    return { spend, gift, artist };
  });
  await notify(db, result.artist.userId, "Recebeste um presente", `${result.gift.emoji} Um fã enviou-te ${result.gift.label}! Os teus ganhos continuam a crescer.`, "/artista/carteira");
  return result.spend;
}

/**
 * Anula um gasto: devolve as moedas aos lotes de onde saíram, retira o desbloqueio
 * (se for episódio) e faz o lançamento inverso (retira ao artista a parte dele).
 */
export async function reverseCoinSpend(tx: Prisma.TransactionClient, spendId: string, adminId: string | null, reason: string) {
  const spend = await tx.coinSpend.findUniqueOrThrow({ where: { id: spendId }, include: { allocations: true } });
  if (spend.reversedAt) return spend;
  for (const a of spend.allocations) {
    await tx.coinLot.update({
      where: { id: a.lotId },
      data: { coinsRemaining: { increment: a.coins }, valueRemainingCents: { increment: a.valueCents } },
    });
  }
  if (spend.valueCents > 0) {
    const platformCents = spend.valueCents - spend.artistCents;
    // Se o ganho ainda está pendente, sai do pendente (o disponível não é tocado) e nunca chega a passar
    const original = await tx.journalEntry.findUnique({ where: { idempotencyKey: `coin-spend:${spend.id}` } });
    let artistAccount = artistAvailable(spend.artistId);
    if (original?.availableAt && !original.releasedAt) {
      const cancel = await tx.journalEntry.updateMany({ where: { id: original.id, releasedAt: null, cancelledAt: null }, data: { cancelledAt: new Date() } });
      if (cancel.count === 1) artistAccount = artistPending(spend.artistId);
    }
    await postEntry(tx, {
      kind: "COIN_SPEND_REVERSED",
      description: `Anulação de gasto de moedas — ${reason}`,
      idempotencyKey: `coin-spend:${spend.id}:reverse`,
      createdById: adminId ?? undefined,
      lines: [
        { account: COINS_OUTSTANDING, amountCents: -spend.valueCents },
        { account: artistAccount, amountCents: spend.artistCents },
        { account: PLATFORM_REVENUE, amountCents: platformCents },
      ],
    });
  }
  if (spend.kind === "SEASON") {
    await tx.entitlement.deleteMany({ where: { coinSpendId: spend.id } });
  } else if (spend.kind === "EPISODE" && spend.episodeId) {
    await tx.entitlement.deleteMany({ where: { userId: spend.userId, episodeId: spend.episodeId, source: "COINS" } });
  }
  return tx.coinSpend.update({ where: { id: spend.id }, data: { reversedAt: new Date() } });
}

/**
 * Anula uma COMPRA de moedas (ex.: comprovativo falso descoberto depois):
 *  1. todos os gastos que usaram moedas desta compra são anulados (episódios voltam a bloquear,
 *     o artista perde a parte correspondente; moedas de outras compras voltam ao fã);
 *  2. as moedas desta compra são retiradas e o lançamento da compra é invertido.
 * Chamado dentro da transação de reversePayment().
 */
export async function reverseCoinPurchase(tx: Prisma.TransactionClient, paymentId: string, adminId: string, reason: string) {
  const lot = await tx.coinLot.findUniqueOrThrow({ where: { paymentRequestId: paymentId } });
  await lockUser(tx, lot.userId);
  const spends = await tx.coinSpend.findMany({
    where: { reversedAt: null, allocations: { some: { lotId: lot.id } } },
    select: { id: true },
  });
  for (const s of spends) await reverseCoinSpend(tx, s.id, adminId, reason);
  await tx.coinLot.update({ where: { id: lot.id }, data: { coinsRemaining: 0, valueRemainingCents: 0, revokedAt: new Date() } });
  return { reversedSpends: spends.length, coins: lot.coinsTotal };
}
