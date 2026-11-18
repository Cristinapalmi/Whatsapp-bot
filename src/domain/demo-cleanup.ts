import type { PrismaClient } from "@prisma/client";
import { business } from "@config/business";
import { reverseCoinSpend } from "./coins/service";
import { deleteObject } from "./storage/core";
import { notify } from "./notify";

/**
 * LIMPEZA DO DEMO — apaga as séries, episódios, artistas e contas de teste criados pelo
 * seed de exemplo (SEED_DEMO). Corre UMA ÚNICA VEZ, automaticamente, no deploy.
 *
 * Nunca toca em contas reais (admin, fãs, artistas verdadeiros) nem nas compras e na
 * contabilidade delas. Se algo real estiver ligado ao demo (ex.: um fã real gastou moedas
 * num episódio de exemplo), NÃO apaga: regista o que encontrou e avisa a administração,
 * que pode confirmar no admin (devolvendo as moedas/pontos aos fãs).
 */

export const DEMO_CLEANUP_KEY = "demoCleanup";

/** Contas criadas pelo seed de exemplo (telefone + link pessoal ou nome). */
const DEMO_ARTISTS = [
  { phone: "+244900000002", slug: "manazinha" },
  { phone: "+244900000012", slug: "tiogingas" },
  { phone: "+244900000013", slug: "kotabento" },
  { phone: "+244900000014", slug: "nayarak" },
  { phone: "+244900000015", slug: "djmalamba" },
  { phone: "+244900000016", slug: "mamarosa" },
];
const DEMO_FAN = { phone: "+244900000003", name: "Fã de Teste" };

export type DemoBlocker = { kind: string; who: string; what: string };
export type DemoAnalysis = {
  userIds: string[];
  artistIds: string[];
  seriesIds: string[];
  episodeIds: string[];
  counts: { users: number; artists: number; series: number; episodes: number };
  blockers: DemoBlocker[];
};

export async function analyzeDemo(db: PrismaClient): Promise<DemoAnalysis> {
  const adminPhone = process.env.ADMIN_PHONE;
  const artists = await db.artistProfile.findMany({
    where: { OR: DEMO_ARTISTS.map((a) => ({ slug: a.slug, user: { phone: a.phone } })) },
    include: { user: true },
  });
  const fan = await db.user.findFirst({ where: { phone: DEMO_FAN.phone, name: DEMO_FAN.name, role: "PUBLIC" } });
  const users = [...artists.map((a) => a.user), ...(fan ? [fan] : [])].filter((u) => u.role !== "ADMIN" && u.phone !== adminPhone);
  const userIds = users.map((u) => u.id);
  const artistIds = artists.filter((a) => userIds.includes(a.userId)).map((a) => a.id);
  const series = await db.series.findMany({ where: { artistId: { in: artistIds } }, include: { episodes: { select: { id: true } } } });
  const seriesIds = series.map((s) => s.id);
  const episodeIds = series.flatMap((s) => s.episodes.map((e) => e.id));

  const notDemo = { userId: { notIn: userIds } };
  const [spends, ents, payments, adUnlocks, payouts] = await Promise.all([
    db.coinSpend.findMany({
      where: { ...notDemo, reversedAt: null, OR: [{ artistId: { in: artistIds } }, { episodeId: { in: episodeIds } }] },
      include: { user: { select: { name: true, phone: true } }, episode: { select: { number: true, series: { select: { title: true } } } } },
    }),
    db.entitlement.findMany({
      where: { ...notDemo, episodeId: { in: episodeIds }, source: { not: "COINS" } },
      include: { user: { select: { name: true, phone: true } }, episode: { select: { number: true, series: { select: { title: true } } } } },
    }),
    db.paymentRequest.findMany({
      where: { ...notDemo, status: { in: ["PENDING", "CONFIRMED"] }, OR: [{ artistId: { in: artistIds } }, { episodeId: { in: episodeIds } }] },
      include: { user: { select: { name: true, phone: true } } },
    }),
    db.adUnlock.findMany({ where: { episodeId: { in: episodeIds }, NOT: { userId: { in: userIds } } }, include: { episode: { select: { number: true, series: { select: { title: true } } } } } }),
    db.payoutRequest.count({ where: { artistId: { in: artistIds } } }),
  ]);
  const who = (u: { name: string; phone: string } | null) => (u ? `${u.name} (${u.phone})` : "conta apagada");
  const blockers: DemoBlocker[] = [
    ...spends.map((s) => ({
      kind: "COIN_SPEND",
      who: who(s.user),
      what: s.kind === "EPISODE" && s.episode ? `gastou ${s.coins} moedas em "${s.episode.series.title}" ep. ${s.episode.number}` : `ofereceu um presente de ${s.coins} moedas a um artista de exemplo`,
    })),
    ...ents.map((e) => ({ kind: `ENTITLEMENT_${e.source}`, who: who(e.user), what: `tem o episódio ${e.episode.number} de "${e.episode.series.title}" desbloqueado (${e.source === "POINTS" ? "com pontos" : e.source === "AD" ? "com anúncio" : e.source.toLowerCase()})` })),
    ...payments.map((p) => ({ kind: "PAYMENT", who: who(p.user), what: `pagamento ${p.status === "PENDING" ? "pendente" : "confirmado"} (${p.kind}) ligado ao demo` })),
    ...adUnlocks.filter((a) => !ents.some((e) => e.episodeId === a.episodeId && e.source === "AD")).map((a) => ({ kind: "AD_UNLOCK", who: a.phone, what: `usou a oferta do anúncio em "${a.episode.series.title}" ep. ${a.episode.number}` })),
    ...(payouts > 0 ? [{ kind: "PAYOUT", who: "artistas de exemplo", what: `${payouts} levantamento(s) registado(s)` }] : []),
  ];
  return {
    userIds,
    artistIds,
    seriesIds,
    episodeIds,
    counts: { users: userIds.length, artists: artistIds.length, series: seriesIds.length, episodes: episodeIds.length },
    blockers,
  };
}

export type DemoCleanupStatus =
  | { status: "done"; at: string; counts: DemoAnalysis["counts"]; refunds?: string[] }
  | { status: "blocked"; at: string; counts: DemoAnalysis["counts"]; blockers: DemoBlocker[] }
  | { status: "nothing"; at: string };

export async function getDemoCleanupStatus(db: PrismaClient): Promise<DemoCleanupStatus | null> {
  const row = await db.setting.findUnique({ where: { key: DEMO_CLEANUP_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as DemoCleanupStatus;
  } catch {
    return null;
  }
}

async function saveStatus(db: PrismaClient, s: DemoCleanupStatus) {
  await db.setting.upsert({ where: { key: DEMO_CLEANUP_KEY }, create: { key: DEMO_CLEANUP_KEY, value: JSON.stringify(s) }, update: { value: JSON.stringify(s) } });
}

/**
 * Corre a limpeza.
 *  - Sem `force`: só apaga se NADA real estiver ligado ao demo; senão regista "blocked" e avisa.
 *  - Com `force` (botão no admin, depois de a administração ver a lista): primeiro devolve as
 *    moedas e os pontos gastos pelos fãs reais nos episódios de exemplo, depois apaga.
 *  - Depois de "done" ou "nothing", nunca mais corre (uma única vez).
 */
export async function runDemoCleanup(db: PrismaClient, { force = false, adminId = null as string | null } = {}): Promise<DemoCleanupStatus> {
  const previous = await getDemoCleanupStatus(db);
  if (previous && (previous.status === "done" || previous.status === "nothing")) return previous;
  const at = new Date().toISOString();
  const a = await analyzeDemo(db);
  if (a.counts.users === 0 && a.counts.series === 0) {
    const s: DemoCleanupStatus = { status: "nothing", at };
    await saveStatus(db, s);
    return s;
  }
  const unresolvable = a.blockers.filter((b) => b.kind === "PAYMENT" || b.kind === "PAYOUT");
  if (a.blockers.length > 0 && (!force || unresolvable.length > 0)) {
    const s: DemoCleanupStatus = { status: "blocked", at, counts: a.counts, blockers: a.blockers };
    await saveStatus(db, s);
    if (!previous || previous.status !== "blocked") {
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      for (const ad of admins)
        await notify(db, ad.id, "Limpeza do demo em pausa", `Há ${a.blockers.length} ligação(ões) de contas reais às séries de exemplo. Vê e decide no Resumo do admin.`, "/admin");
    }
    return s;
  }

  // Ficheiros no armazenamento (os de exemplo em /public — "/covers", "/samples" — não são apagados)
  const [series, artists] = await Promise.all([
    db.series.findMany({ where: { id: { in: a.seriesIds } }, include: { episodes: true } }),
    db.artistProfile.findMany({ where: { id: { in: a.artistIds } } }),
  ]);
  const keys = [
    ...series.flatMap((s) => [s.coverKey, s.trailerKey, ...s.episodes.flatMap((e) => [e.videoKey, e.videoKeyHd, e.subtitlesKey])]),
    ...artists.map((x) => x.photoKey),
  ].filter((k): k is string => !!k && !k.startsWith("/"));

  const refunds: string[] = [];
  await db.$transaction(
    async (tx) => {
      // 1) (só com force) devolver aos fãs reais o que gastaram no demo
      const spends = await tx.coinSpend.findMany({
        where: { userId: { notIn: a.userIds }, reversedAt: null, OR: [{ artistId: { in: a.artistIds } }, { episodeId: { in: a.episodeIds } }] },
      });
      for (const s of spends) {
        await reverseCoinSpend(tx, s.id, adminId, "Série de exemplo removida");
        refunds.push(`${s.coins} moedas devolvidas`);
        await notify(tx, s.userId, "Moedas devolvidas", `Removemos as séries de exemplo e devolvemos-te ${s.coins} moedas.`, "/loja");
      }
      const pointEnts = await tx.entitlement.findMany({ where: { userId: { notIn: a.userIds }, episodeId: { in: a.episodeIds }, source: "POINTS" } });
      for (const e of pointEnts) {
        await tx.pointsTransaction.create({ data: { userId: e.userId, delta: business.points.costPerEpisode, reason: "ADMIN_ADJUST" } });
        refunds.push(`${business.points.costPerEpisode} pontos devolvidos`);
      }
      // A oferta do anúncio usada num episódio de exemplo volta a ficar livre
      await tx.adUnlock.deleteMany({ where: { episodeId: { in: a.episodeIds } } });

      // 2) apagar o demo (a contabilidade fica intacta: as contas dos artistas ficam sem ligação, com saldo zero)
      await tx.coinSpend.deleteMany({ where: { OR: [{ artistId: { in: a.artistIds } }, { userId: { in: a.userIds } }] } });
      await tx.paymentRequest.updateMany({ where: { OR: [{ artistId: { in: a.artistIds } }, { episodeId: { in: a.episodeIds } }] }, data: { artistId: null, episodeId: null } });
      await tx.user.updateMany({ where: { referredByArtistId: { in: a.artistIds } }, data: { referredByArtistId: null } });
      await tx.setting.deleteMany({ where: { key: "suggestedSeriesId", value: { in: a.seriesIds } } });
      await tx.series.deleteMany({ where: { id: { in: a.seriesIds } } }); // episódios, vistos, denúncias, favoritos: em cascata
      await tx.user.deleteMany({ where: { id: { in: a.userIds } } }); // perfis de artista, consentimentos, notificações: em cascata
      await tx.loginAttempt.deleteMany({ where: { phone: { in: [...DEMO_ARTISTS.map((x) => x.phone), DEMO_FAN.phone] } } });
    },
    { timeout: 60_000 },
  );

  for (const k of keys) await deleteObject("media", k).catch((e) => console.warn("[demo] ficheiro não apagado:", k, e instanceof Error ? e.message : e));
  const s: DemoCleanupStatus = { status: "done", at, counts: a.counts, ...(refunds.length ? { refunds } : {}) };
  await saveStatus(db, s);
  return s;
}
