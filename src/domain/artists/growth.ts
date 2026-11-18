import type { Prisma, PrismaClient } from "@prisma/client";
import { business } from "@config/business";
import { PLATFORM_REVENUE, artistAvailable } from "../money/accounts";
import { postEntry, type Tx } from "../money/ledger";
import { notify } from "../notify";
import { getInt, getInts } from "../settings";
import { formatKz, kzToCents } from "@/lib/money";

/**
 * CRESCIMENTO DOS ARTISTAS:
 *  - Artistas Fundadores (os primeiros 20, editável): parte maior nos primeiros 3 meses
 *    desde o registo, selo "Artista Fundador" para sempre e séries a começar em Normal.
 *  - Bónus por marcos de cada série (500 / 1.000 / 5.000 desbloqueios pagos), pagos uma vez,
 *    da parte da plataforma, registados no livro-razão.
 *  - "Traz um kamba": quem convida ganha um bónus quando o convidado faz a 1.ª venda (uma vez).
 */

export const MS_DAY = 86_400_000;

/** Parte do artista (%) num dado momento. */
export async function artistShareFor(db: Tx, artist: { founderNumber: number | null; createdAt: Date }, now = new Date()) {
  if (artist.founderNumber) {
    const c = await getInts(db, ["founderMonths", "founderSharePercent"]);
    const until = new Date(artist.createdAt);
    until.setMonth(until.getMonth() + c.founderMonths);
    if (now < until) return c.founderSharePercent;
  }
  return business.artistSharePercent;
}

export function founderUntil(createdAt: Date, months: number) {
  const d = new Date(createdAt);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Vagas de Fundador que ainda restam. */
export async function foundersLeft(db: Tx) {
  const [limit, used] = await Promise.all([getInt(db, "foundersLimit"), db.artistProfile.count({ where: { founderNumber: { not: null } } })]);
  return { limit, left: Math.max(0, limit - used) };
}

/** Dá o número de Fundador a um artista acabado de aprovar, se ainda houver vagas. Chamar dentro de uma transação. */
export async function assignFounder(tx: Prisma.TransactionClient, artistId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('founders'))`;
  const limit = await getInt(tx, "foundersLimit");
  const max = await tx.artistProfile.aggregate({ _max: { founderNumber: true }, _count: { founderNumber: true } });
  if (max._count.founderNumber >= limit) return null;
  const n = (max._max.founderNumber ?? 0) + 1;
  await tx.artistProfile.update({ where: { id: artistId }, data: { founderNumber: n } });
  return n;
}

async function payBonus(tx: Prisma.TransactionClient, artistId: string, cents: number, key: string, description: string) {
  if (cents <= 0) return;
  await postEntry(tx, {
    kind: "ARTIST_BONUS",
    description,
    idempotencyKey: key,
    lines: [
      { account: PLATFORM_REVENUE, amountCents: cents }, // sai da parte da plataforma
      { account: artistAvailable(artistId), amountCents: -cents },
    ],
  });
}

export async function milestoneConfig(db: Tx) {
  const c = await getInts(db, ["milestone1Unlocks", "milestone1BonusKz", "milestone2Unlocks", "milestone2BonusKz", "milestone3Unlocks", "milestone3BonusKz"]);
  return [
    { level: 1, unlocks: c.milestone1Unlocks, bonusCents: kzToCents(c.milestone1BonusKz), crown: false },
    { level: 2, unlocks: c.milestone2Unlocks, bonusCents: kzToCents(c.milestone2BonusKz), crown: false },
    { level: 3, unlocks: c.milestone3Unlocks, bonusCents: kzToCents(c.milestone3BonusKz), crown: true },
  ].sort((a, b) => a.unlocks - b.unlocks);
}

/** Marcos de ganhos (só aviso): "A tua série passou os 10.000 Kz!" */
export const EARNED_MARKS_KZ = [10_000, 50_000, 100_000, 500_000, 1_000_000];

/**
 * Depois de uma venda paga (episódio ou temporada): 1.ª venda, convite, marcos e ganhos.
 * Cada coisa acontece uma única vez (chaves únicas na base de dados e no livro-razão).
 */
export async function afterArtistSale(db: PrismaClient, { artistId, seriesId }: { artistId: string; seriesId: string }) {
  const artist = await db.artistProfile.findUnique({ where: { id: artistId } });
  if (!artist) return;

  // 1.ª venda de sempre
  const first = await db.artistProfile.updateMany({ where: { id: artistId, firstSaleAt: null }, data: { firstSaleAt: new Date() } });
  if (first.count === 1) {
    await notify(db, artist.userId, "O teu primeiro fã 🎉", "🎉 O teu primeiro fã pagou para ver a tua série!", "/artista");
    // "Traz um kamba": bónus para quem convidou, uma única vez
    if (artist.invitedByArtistId) {
      const bonusKz = await getInt(db, "artistReferralBonusKz");
      const inviter = await db.artistProfile.findUnique({ where: { id: artist.invitedByArtistId } });
      if (inviter && bonusKz > 0) {
        await db.$transaction(async (tx) => {
          const mark = await tx.artistProfile.updateMany({ where: { id: artistId, referralBonusPaidAt: null }, data: { referralBonusPaidAt: new Date() } });
          if (mark.count !== 1) return;
          await payBonus(tx, inviter.id, kzToCents(bonusKz), `artist-referral:${artistId}`, `Bónus "Traz um kamba": ${artist.stageName} fez a 1.ª venda`);
        });
        await notify(db, inviter.userId, "Bónus de convite 🤝", `O teu kamba ${artist.stageName} fez a primeira venda. Ganhaste um bónus de ${formatKz(kzToCents(bonusKz))}!`, "/artista/carteira");
      }
    }
  }

  // Marcos de desbloqueios pagos (bónus)
  const series = await db.series.findUnique({ where: { id: seriesId } });
  if (!series) return;
  const unlocks = await db.entitlement.count({ where: { source: "COINS", episode: { seriesId } } });
  for (const m of await milestoneConfig(db)) {
    if (unlocks < m.unlocks) continue;
    const paid = await db.$transaction(async (tx) => {
      const exists = await tx.seriesMilestone.findUnique({ where: { seriesId_kind_threshold: { seriesId, kind: "UNLOCKS", threshold: m.unlocks } } });
      if (exists) return false;
      await tx.seriesMilestone.create({ data: { seriesId, kind: "UNLOCKS", threshold: m.unlocks, bonusCents: m.bonusCents } });
      await payBonus(tx, artistId, m.bonusCents, `milestone:${seriesId}:${m.unlocks}`, `Bónus de marco: "${series.title}" chegou a ${m.unlocks} desbloqueios`);
      if (m.crown) await tx.series.update({ where: { id: seriesId }, data: { crownedAt: new Date() } });
      return true;
    }).catch(() => false); // dois pedidos ao mesmo tempo: a chave única garante um só bónus
    if (paid)
      await notify(db, artist.userId, m.crown ? "Série coroada 👑" : "Marco atingido 🏆",
        `A tua série "${series.title}" chegou a ${m.unlocks.toLocaleString("pt-AO")} desbloqueios!${m.bonusCents ? ` Ganhaste um bónus de ${formatKz(m.bonusCents)}.` : ""}${m.crown ? " Agora tem a coroa 👑." : ""}`,
        "/artista/carteira");
  }

  // Marcos de ganhos (só aviso)
  const earned = await db.coinSpend.aggregate({ where: { artistId, reversedAt: null, OR: [{ seriesId }, { episode: { seriesId } }] }, _sum: { artistCents: true } });
  const earnedKz = Math.floor((earned._sum.artistCents ?? 0) / 100);
  for (const kz of EARNED_MARKS_KZ) {
    if (earnedKz < kz) break;
    const created = await db.seriesMilestone.createMany({ data: [{ seriesId, kind: "EARNED", threshold: kz }], skipDuplicates: true });
    if (created.count === 1) await notify(db, artist.userId, "Marco de ganhos 🔥", `A tua série "${series.title}" passou os ${formatKz(kzToCents(kz))}!`, "/artista");
  }
}

/** Início do dia em Luanda (UTC+1). */
export function luandaDayStart(now = new Date()) {
  const l = new Date(now.getTime() + 3600_000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - 3600_000);
}

/** Resumo diário para cada artista que vendeu hoje: "Hoje ganhaste X Kz com Y desbloqueios 🔥". Uma vez por dia. */
export async function sendDailySummaries(db: PrismaClient, now = new Date()) {
  const from = luandaDayStart(now);
  const dayKey = `dailySummary:${from.toISOString().slice(0, 10)}`;
  const claimed = await db.setting.createMany({ data: [{ key: dayKey, value: now.toISOString() }], skipDuplicates: true });
  if (claimed.count === 0) return 0;
  const spends = await db.coinSpend.findMany({
    where: { createdAt: { gte: from, lt: now }, reversedAt: null, kind: { in: ["EPISODE", "SEASON"] } },
    select: { artistId: true, artistCents: true, id: true },
  });
  const unlockCounts = await db.entitlement.groupBy({ by: ["coinSpendId"], where: { coinSpendId: { in: spends.map((s) => s.id) } }, _count: true });
  const perSpend = new Map(unlockCounts.map((u) => [u.coinSpendId, u._count]));
  const per = new Map<string, { cents: number; unlocks: number }>();
  for (const s of spends) {
    const x = per.get(s.artistId) ?? { cents: 0, unlocks: 0 };
    x.cents += s.artistCents;
    x.unlocks += perSpend.get(s.id) ?? 1;
    per.set(s.artistId, x);
  }
  const artists = await db.artistProfile.findMany({ where: { id: { in: [...per.keys()] } }, select: { id: true, userId: true } });
  for (const a of artists) {
    const x = per.get(a.id)!;
    if (x.cents <= 0) continue;
    await notify(db, a.userId, "Resumo do dia 🔥", `Hoje ganhaste ${formatKz(x.cents)} com ${x.unlocks} ${x.unlocks === 1 ? "desbloqueio" : "desbloqueios"} 🔥`, "/artista");
  }
  return artists.length;
}

/** Total já pago aos artistas (levantamentos pagos) — contador público. */
export async function totalPaidToArtists(db: Tx) {
  const r = await db.payoutRequest.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } });
  return r._sum.amountCents ?? 0;
}

/** Os maiores fãs de um artista: quem mais moedas gastou nas séries e presentes dele (Superfãs). */
export async function topSpenders(db: Tx, artistId: string, limit = 10) {
  const rows = await db.coinSpend.groupBy({
    by: ["userId"],
    where: { artistId, reversedAt: null },
    _sum: { coins: true },
    _min: { createdAt: true },
    orderBy: [{ _sum: { coins: "desc" } }, { _min: { createdAt: "asc" } }],
    take: limit,
  });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
  const byId = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => {
    const parts = (byId.get(r.userId) ?? "Fã").trim().split(/\s+/);
    return { userId: r.userId, displayName: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0], coins: r._sum.coins ?? 0 };
  });
}

/** Ganhos do artista hoje (desde a meia-noite de Luanda). */
export async function earnedTodayCents(db: Tx, artistId: string, now = new Date()) {
  const { EARNING_KINDS } = await import("../money/accounts");
  const r = await db.ledgerLine.aggregate({
    where: { account: { code: artistAvailable(artistId).code }, createdAt: { gte: luandaDayStart(now) }, entry: { kind: { in: [...EARNING_KINDS] } } },
    _sum: { amountCents: true },
  });
  return 0 - (r._sum.amountCents ?? 0) || 0;
}

/** Seguir um artista (ou deixar de seguir). */
export async function toggleFollow(db: PrismaClient, userId: string, artistId: string) {
  const existing = await db.follow.findUnique({ where: { userId_artistId: { userId, artistId } } });
  if (existing) {
    await db.follow.delete({ where: { id: existing.id } });
    return false;
  }
  await db.follow.create({ data: { userId, artistId } });
  return true;
}

/** Avisa quem segue o artista (série nova ou episódios novos). */
export async function notifyFollowers(db: PrismaClient, artistId: string, title: string, body: string, link: string) {
  const follows = await db.follow.findMany({ where: { artistId }, select: { userId: true } });
  if (follows.length === 0) return 0;
  await db.notification.createMany({ data: follows.map((f) => ({ userId: f.userId, title, body, link })) });
  return follows.length;
}

/** Artistas de quem este fã é Superfã (está nos 10 maiores fãs). */
export async function superfanOf(db: Tx, userId: string) {
  const spent = await db.coinSpend.groupBy({ by: ["artistId"], where: { userId, reversedAt: null }, _sum: { coins: true }, orderBy: { _sum: { coins: "desc" } }, take: 10 });
  const out: { artistId: string; stageName: string; slug: string; rank: number }[] = [];
  for (const s of spent) {
    const top = await topSpenders(db, s.artistId, 10);
    const rank = top.findIndex((t) => t.userId === userId);
    if (rank < 0) continue;
    const a = await db.artistProfile.findUnique({ where: { id: s.artistId }, select: { stageName: true, slug: true } });
    if (a) out.push({ artistId: s.artistId, stageName: a.stageName, slug: a.slug, rank: rank + 1 });
  }
  return out;
}
