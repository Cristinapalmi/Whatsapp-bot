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

/* ---------- BLOCOS: o painel do artista só mostra valores em blocos (ex.: 5.000 Kz) ---------- */
export const blockCentsOf = async (db: Tx) => kzToCents(await getInt(db, "earningsBlockKz"));
/** Arredonda para baixo ao bloco (ex.: 7.300 Kz → 5.000 Kz). */
export const floorBlock = (cents: number, block: number) => (cents > 0 ? Math.floor(cents / block) * block : 0);
/** Progresso dentro do bloco atual (0..1), sem números. */
export const blockProgress = (cents: number, block: number) => (cents > 0 ? (cents % block) / block : 0);
/** Texto de um valor só se chegar a um bloco; senão null (não se mostra). */
const blockText = (cents: number, block: number) => (cents >= block ? formatKz(floorBlock(cents, block)) : null);

/** Avisa quando o disponível completa um novo bloco: "🎉 Ganhaste 5.000 Kz! Já podes levantar." */
export async function checkAvailableBlocks(db: PrismaClient, artistId: string) {
  const { balance } = await import("../money/ledger");
  const [block, artist, available] = await Promise.all([
    blockCentsOf(db),
    db.artistProfile.findUnique({ where: { id: artistId }, select: { userId: true, lastAvailableBlock: true } }),
    balance(db, artistAvailable(artistId)),
  ]);
  if (!artist) return 0;
  const blocks = available > 0 ? Math.floor(available / block) : 0;
  if (blocks === artist.lastAvailableBlock) return 0;
  // Só avisa quando sobe; se desceu (levantamento), só atualiza
  const upd = await db.artistProfile.updateMany({ where: { id: artistId, lastAvailableBlock: artist.lastAvailableBlock }, data: { lastAvailableBlock: blocks } });
  if (upd.count === 1 && blocks > artist.lastAvailableBlock) {
    const gained = (blocks - artist.lastAvailableBlock) * block;
    await notify(db, artist.userId, "Novo bloco disponível 🎉", `🎉 Ganhaste ${formatKz(gained)}! Já podes levantar.`, "/artista/carteira#levantar");
    return blocks - artist.lastAvailableBlock;
  }
  return 0;
}

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
    const hasPublished = await db.series.count({ where: { artistId, publishedAt: { not: null } } });
    if (artist.invitedByArtistId && hasPublished > 0) {
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

  // Aviso a cada desbloqueio: só se o artista ligou nas definições (desligado por defeito)
  if (artist.notifyEachUnlock && first.count === 0)
    await notify(db, artist.userId, "Mais receita 🔥", "A tua série acabou de gerar mais receita! Os teus ganhos continuam a crescer.", "/artista");

  // Metas de ganhos do artista (todas as séries) — só celebração, sem prémio em dinheiro
  await checkArtistGoals(db, artist);

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

/** Metas de ganhos do artista: cada bloco completo (5.000, 10.000, 15.000 Kz…). */
async function checkArtistGoals(db: PrismaClient, artist: { id: string; userId: string }) {
  const { getArtistWallet } = await import("../money/ledger");
  const blockKz = await getInt(db, "earningsBlockKz");
  const totalKz = Math.floor((await getArtistWallet(db, artist.id)).earnedTotalCents / 100);
  const reached = Math.floor(totalKz / blockKz);
  if (reached <= 0) return;
  const last = await db.artistGoal.aggregate({ where: { artistId: artist.id, thresholdKz: { gte: blockKz } }, _max: { thresholdKz: true } });
  const from = Math.max(1, Math.floor((last._max.thresholdKz ?? 0) / blockKz) + 1, reached - 20);
  for (let k = from; k <= reached; k++) {
    const kz = k * blockKz;
    const r = await db.artistGoal.createMany({ data: [{ artistId: artist.id, thresholdKz: kz }], skipDuplicates: true });
    if (r.count === 1) await notify(db, artist.userId, "Meta atingida 🏆", `🎉 Já acumulaste ${formatKz(kzToCents(kz))}!`, "/artista");
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
    await notify(db, a.userId, "Resumo do dia 🔥", `Hoje a tua série gerou ${formatKz(x.cents)}! (${x.unlocks} ${x.unlocks === 1 ? "desbloqueio" : "desbloqueios"}) 🔥`, "/artista");
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
    where: { account: { code: { in: [artistAvailable(artistId).code, `artist:${artistId}:pending`] } }, createdAt: { gte: luandaDayStart(now) }, entry: { kind: { in: [...EARNING_KINDS] } } },
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


/** Histórico de ganhos (Kz por dia, últimos 30 dias; ou por semana, últimas 12 semanas). Dados reais do livro-razão. */
export async function earningsHistory(db: Tx, artistId: string, by: "day" | "week", now = new Date()) {
  const { EARNING_KINDS } = await import("../money/accounts");
  const n = by === "day" ? 30 : 12;
  const unit = by === "day" ? MS_DAY : 7 * MS_DAY;
  const end = luandaDayStart(now).getTime() + MS_DAY; // fim de hoje (Luanda)
  const start = end - n * unit;
  const lines = await db.ledgerLine.findMany({
    where: { account: { code: { in: [artistAvailable(artistId).code, `artist:${artistId}:pending`] } }, createdAt: { gte: new Date(start) }, entry: { kind: { in: [...EARNING_KINDS] } } },
    select: { amountCents: true, createdAt: true },
  });
  const buckets = Array.from({ length: n }, (_, i) => ({ start: new Date(start + i * unit), cents: 0 }));
  for (const l of lines) {
    const i = Math.floor((l.createdAt.getTime() - start) / unit);
    if (i >= 0 && i < n) buckets[i].cents += -l.amountCents;
  }
  return buckets;
}

/** Episódios que mais renderam ao artista (desbloqueios individuais; as temporadas contam na série). */
export async function topEpisodes(db: Tx, artistId: string, limit = 5) {
  const rows = await db.coinSpend.groupBy({
    by: ["episodeId"],
    where: { artistId, kind: "EPISODE", reversedAt: null, episodeId: { not: null } },
    _sum: { artistCents: true },
    _count: true,
    orderBy: { _sum: { artistCents: "desc" } },
    take: limit,
  });
  const eps = await db.episode.findMany({ where: { id: { in: rows.map((r) => r.episodeId!) } }, select: { id: true, number: true, title: true, series: { select: { title: true } } } });
  const byId = new Map(eps.map((e) => [e.id, e]));
  return rows.map((r) => ({ episode: byId.get(r.episodeId!)!, cents: r._sum.artistCents ?? 0, unlocks: r._count })).filter((r) => r.episode);
}

/** Pessoas a acompanhar cada série (viram ou desbloquearam episódios) e quantas a guardaram na lista. */
export async function seriesAudience(db: Tx, artistId: string) {
  const series = await db.series.findMany({ where: { artistId, status: { in: ["PUBLISHED", "HIDDEN"] }, purgedAt: null }, select: { id: true, title: true, _count: { select: { favorites: true } } } });
  return Promise.all(
    series.map(async (s) => {
      const [watched, unlocked] = await Promise.all([
        db.watchProgress.findMany({ where: { episode: { seriesId: s.id } }, select: { userId: true }, distinct: ["userId"] }),
        db.entitlement.findMany({ where: { episode: { seriesId: s.id } }, select: { userId: true }, distinct: ["userId"] }),
      ]);
      const viewers = new Set([...watched, ...unlocked].map((x) => x.userId)).size;
      return { id: s.id, title: s.title, viewers, saved: s._count.favorites };
    }),
  );
}

/** Tudo o que o painel financeiro precisa — sempre a partir dos dados reais. */
export async function artistMoneySnapshot(db: Tx, artistId: string, now = new Date()) {
  const { getArtistWallet, pendingSchedule } = await import("../money/ledger");
  const { payoutMinCents } = await import("../payouts/service");
  const artist = await db.artistProfile.findUniqueOrThrow({ where: { id: artistId }, select: { achievementsSeenAt: true, createdAt: true } });
  const [schedule, wallet, paid, today, minCents, goals, milestones, series] = await Promise.all([
    pendingSchedule(db, artistId),
    getArtistWallet(db, artistId, now),
    db.payoutRequest.aggregate({ where: { artistId, status: "PAID" }, _sum: { amountCents: true } }),
    earnedTodayCents(db, artistId, now),
    payoutMinCents(db, artistId),
    db.artistGoal.findMany({ where: { artistId }, orderBy: { createdAt: "desc" } }),
    milestoneConfig(db),
    db.series.findMany({ where: { artistId, status: "PUBLISHED" }, select: { id: true, title: true } }),
  ]);
  const totalKz = Math.floor(wallet.earnedTotalCents / 100);
  // Próxima meta de ganhos: o próximo bloco (sem prémio em dinheiro)
  const blockKz = await getInt(db, "earningsBlockKz");
  const prevGoalKz = Math.max(0, Math.floor(totalKz / blockKz) * blockKz);
  const nextGoalKz = prevGoalKz + blockKz;
  // Próxima conquista com prémio: o marco de desbloqueios mais perto, entre as séries publicadas
  let nextReward: { seriesTitle: string; unlocks: number; target: number; bonusCents: number; crown: boolean } | null = null;
  for (const s of series) {
    const unlocks = await db.entitlement.count({ where: { source: "COINS", episode: { seriesId: s.id } } });
    const m = milestones.find((x) => unlocks < x.unlocks);
    if (!m) continue;
    const left = m.unlocks - unlocks;
    if (!nextReward || left < nextReward.target - nextReward.unlocks)
      nextReward = { seriesTitle: s.title, unlocks, target: m.unlocks, bonusCents: m.bonusCents, crown: m.crown };
  }
  // Conquistas novas desde a última visita (para a animação), só reais
  const since = artist.achievementsSeenAt ?? artist.createdAt;
  const [newGoals, newMilestones] = await Promise.all([
    db.artistGoal.findMany({ where: { artistId, createdAt: { gt: since } }, orderBy: { createdAt: "asc" } }),
    db.seriesMilestone.findMany({ where: { kind: "UNLOCKS", series: { artistId }, createdAt: { gt: since } }, include: { series: { select: { title: true, crownedAt: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const achievements = [
    ...newGoals.filter((g) => g.thresholdKz % blockKz === 0).map((g) => ({ id: `g-${g.id}`, at: g.createdAt.getTime(), title: `🎉 Já acumulaste ${formatKz(kzToCents(g.thresholdKz))}!`, prizeCents: 0 })),
    ...newMilestones.map((m) => ({ id: `m-${m.id}`, at: m.createdAt.getTime(), title: `"${m.series.title}" chegou a ${m.threshold.toLocaleString("pt-AO")} desbloqueios!`, prizeCents: m.bonusCents })),
  ].sort((a, b) => a.at - b.at);
  return {
    totalCents: wallet.earnedTotalCents,
    pendingCents: wallet.pendingCents,
    /** Quando o pendente fica disponível (datas reais de cada ganho). */
    pendingSchedule: schedule.map((x) => ({ availableAt: x.availableAt.toISOString(), cents: x.cents, daysLeft: Math.max(0, Math.ceil((x.availableAt.getTime() - now.getTime()) / MS_DAY)) })),
    availableCents: wallet.availableCents,
    processingCents: wallet.processingCents,
    withdrawnCents: paid._sum.amountCents ?? 0,
    monthCents: wallet.earnedThisMonthCents,
    todayCents: today,
    minPayoutCents: minCents,
    goal: nextGoalKz ? { targetCents: kzToCents(nextGoalKz), fromCents: kzToCents(prevGoalKz) } : null,
    goalsReached: goals.length,
    nextReward,
    achievements,
  };
}
export type ArtistMoneySnapshot = Awaited<ReturnType<typeof artistMoneySnapshot>>;

/**
 * Repor o contador de Fundadores (antes do lançamento, depois de apagar as contas de teste):
 * os artistas que ainda existem são renumerados por ordem de registo (1, 2, 3…, até ao limite)
 * e as vagas das contas apagadas voltam a ficar livres. Não mexe em dinheiro.
 */
export async function resetFounders(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('founders'))`;
    const limit = await getInt(tx, "foundersLimit");
    await tx.artistProfile.updateMany({ where: { founderNumber: { not: null } }, data: { founderNumber: null } });
    const artists = await tx.artistProfile.findMany({ where: { status: "APPROVED" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit, select: { id: true } });
    for (let i = 0; i < artists.length; i++) await tx.artistProfile.update({ where: { id: artists[i].id }, data: { founderNumber: i + 1 } });
    return { founders: artists.length, left: Math.max(0, limit - artists.length) };
  });
}


/**
 * O que o painel MOSTRA (só blocos, sem valores abaixo do bloco). Os valores exatos ficam no
 * servidor e no extrato da Carteira.
 */
export function toMoneyDisplay(s: ArtistMoneySnapshot, blockCents: number) {
  const nextPending = s.pendingSchedule[0];
  return {
    blockCents,
    total: { shownCents: floorBlock(s.totalCents, blockCents), progress: blockProgress(s.totalCents, blockCents), blocks: Math.floor(Math.max(0, s.totalCents) / blockCents) },
    pending: { shownCents: floorBlock(s.pendingCents, blockCents), hasSome: s.pendingCents > 0, daysLeft: nextPending ? nextPending.daysLeft : null },
    available: { shownCents: floorBlock(s.availableCents, blockCents), progress: blockProgress(s.availableCents, blockCents), blocks: Math.floor(Math.max(0, s.availableCents) / blockCents) },
    canWithdraw: s.availableCents >= s.minPayoutCents,
    minPayoutCents: s.minPayoutCents,
    withdrawnCents: s.withdrawnCents,
    processingCents: s.processingCents,
    activeToday: s.todayCents > 0,
    goal: s.goal ? { targetCents: s.goal.targetCents, progress: Math.max(0, Math.min(1, (s.totalCents - s.goal.fromCents) / (s.goal.targetCents - s.goal.fromCents))) } : null,
    goalsReached: s.goalsReached,
    nextReward: s.nextReward ? { ...s.nextReward, bonusCents: s.nextReward.bonusCents >= blockCents ? floorBlock(s.nextReward.bonusCents, blockCents) : 0, hasBonus: s.nextReward.bonusCents > 0 } : null,
    achievements: s.achievements.map((a) => ({ ...a, prizeCents: a.prizeCents >= blockCents ? floorBlock(a.prizeCents, blockCents) : 0, hasPrize: a.prizeCents > 0 })),
  };
}
export type MoneyDisplay = ReturnType<typeof toMoneyDisplay>;
