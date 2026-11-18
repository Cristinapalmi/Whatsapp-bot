import type { PrismaClient } from "@prisma/client";
import { luandaDayStart } from "./growth";
import { paidUnlocks, tierUpgradeUnlocks } from "../coins/service";
import { publicName } from "../points";

/** "Agora mesmo": atividade recente REAL. Desbloqueios sem identificar o fã; presentes com o nome público. */
export async function recentActivity(db: PrismaClient, artistId: string, limit = 8) {
  const [spends, follows] = await Promise.all([
    db.coinSpend.findMany({
      where: { artistId, reversedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true } }, episode: { select: { number: true, series: { select: { title: true } } } }, series: { select: { title: true } } },
    }),
    db.follow.findMany({ where: { artistId }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, createdAt: true } }),
  ]);
  const gifts = await db.giftType.findMany({ where: { code: { in: spends.map((s) => s.giftCode ?? "") } } });
  const g = new Map(gifts.map((x) => [x.code, x]));
  const items = [
    ...spends.map((s) => ({
      id: s.id,
      at: s.createdAt,
      icon: s.kind === "GIFT" ? g.get(s.giftCode ?? "")?.emoji ?? "🎁" : s.kind === "SEASON" ? "🎬" : "🔓",
      text:
        s.kind === "GIFT"
          ? `${publicName(s.user.name)} enviou ${g.get(s.giftCode ?? "")?.label ?? "um presente"}`
          : s.kind === "SEASON"
            ? `Um fã desbloqueou a temporada de “${s.series?.title ?? "uma série"}”`
            : `Um fã desbloqueou o ep. ${s.episode?.number ?? "?"} de “${s.episode?.series.title ?? "uma série"}”`,
      cents: s.artistCents,
    })),
    ...follows.map((f) => ({ id: f.id, at: f.createdAt, icon: "➕", text: "Tens um novo seguidor", cents: 0 })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Ganhos de hoje por série (episódios e temporadas). */
export async function seriesTodayCents(db: PrismaClient, artistId: string, now = new Date()) {
  const spends = await db.coinSpend.findMany({
    where: { artistId, reversedAt: null, kind: { in: ["EPISODE", "SEASON"] }, createdAt: { gte: luandaDayStart(now) } },
    select: { artistCents: true, seriesId: true, episode: { select: { seriesId: true } } },
  });
  const m = new Map<string, number>();
  for (const s of spends) {
    const sid = s.seriesId ?? s.episode?.seriesId;
    if (sid) m.set(sid, (m.get(sid) ?? 0) + s.artistCents);
  }
  return m;
}

/** Nível do artista (o melhor nível das séries publicadas) e progresso para o próximo. */
export async function artistLevel(db: PrismaClient, artistId: string) {
  const series = await db.series.findMany({ where: { artistId, status: "PUBLISHED" }, select: { id: true, tier: true } });
  if (series.length === 0) return { tier: null as null | "ENTRY" | "NORMAL" | "PREMIUM", progress: 0, now: 0, target: 0 };
  const rank = { ENTRY: 0, NORMAL: 1, PREMIUM: 2 } as const;
  const best = series.reduce((a, b) => (rank[b.tier] > rank[a.tier] ? b : a));
  if (best.tier !== "ENTRY") return { tier: best.tier, progress: 1, now: 0, target: 0 };
  const target = await tierUpgradeUnlocks(db);
  const now = Math.max(...(await Promise.all(series.map((s) => paidUnlocks(db, s.id)))));
  return { tier: best.tier, progress: Math.min(1, now / target), now, target };
}

/** Lista de tarefas para artistas novos ("O teu perfil está X% completo"). */
export async function starterChecklist(db: PrismaClient, artist: { id: string; photoKey: string | null; bio: string | null; tiktokUrl: string | null; instagramUrl: string | null; firstSaleAt: Date | null }) {
  const [published, visits, firstSeries] = await Promise.all([
    db.series.count({ where: { artistId: artist.id, publishedAt: { not: null } } }),
    db.referralVisit.aggregate({ where: { artistId: artist.id }, _sum: { visits: true } }),
    db.series.findFirst({ where: { artistId: artist.id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);
  const tasks = [
    { key: "perfil", label: "Completar perfil (foto, bio e TikTok ou Instagram)", done: !!(artist.photoKey && artist.bio && (artist.tiktokUrl || artist.instagramUrl)), href: "#perfil", cta: "Completar" },
    { key: "serie", label: "Publicar a 1.ª série", done: published > 0, href: firstSeries ? `/artista/series/${firstSeries.id}` : "/artista/series/nova", cta: firstSeries ? "Continuar" : "Criar série" },
    { key: "link", label: "Partilhar o teu link", done: (visits._sum.visits ?? 0) > 0, href: "#link", cta: "Partilhar" },
    { key: "fa", label: "Conseguir o 1.º fã", done: !!artist.firstSaleAt, href: "#kit", cta: "Ver como" },
  ];
  return { tasks, percent: Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100) };
}
