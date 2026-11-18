import Link from "next/link";
import { brand } from "@config/brand";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { CATEGORY_LABELS, HOME_ROWS } from "@/lib/categories";
import { SeriesCard, SeriesRow, type SeriesCardData } from "@/components/SeriesCard";
import { IconPlay, IconTrophy } from "@/components/icons";
import { RankingList } from "@/components/RankingList";
import { EmptyState } from "@/components/EmptyState";
import { monthlyRanking, sortByViews } from "@/domain/ranking";

export const dynamic = "force-dynamic";

/** Página inicial: o catálogo aparece logo, mesmo sem conta. */
export default async function Home() {
  const user = await getCurrentUser();
  const series = await db.series.findMany({
    where: { status: "PUBLISHED" },
    include: { artist: { select: { stageName: true } }, episodes: { where: { published: true }, select: { id: true, number: true } } },
    orderBy: { publishedAt: "desc" },
  });

  const epToSeries = new Map<string, string>();
  for (const s of series) for (const e of s.episodes) epToSeries.set(e.id, s.id);

  // Visualizações (total) e "Em alta" (tempo visto nos últimos 7 dias)
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [viewsByEp, trending, ranking] = await Promise.all([
    db.watchProgress.groupBy({ by: ["episodeId"], _count: { _all: true } }),
    db.watchLog.groupBy({ by: ["episodeId"], where: { day: { gte: since } }, _sum: { seconds: true } }),
    monthlyRanking(db),
  ]);
  const views = new Map<string, number>();
  for (const v of viewsByEp) {
    const sid = epToSeries.get(v.episodeId);
    if (sid) views.set(sid, (views.get(sid) ?? 0) + v._count._all);
  }
  const hotScore = new Map<string, number>();
  for (const t of trending) {
    const sid = epToSeries.get(t.episodeId);
    if (sid) hotScore.set(sid, (hotScore.get(sid) ?? 0) + (t._sum.seconds ?? 0));
  }

  const twoWeeks = Date.now() - 14 * 24 * 3600 * 1000;
  const cards = new Map<string, SeriesCardData>();
  for (const s of series) {
    cards.set(s.id, {
      slug: s.slug, title: s.title, category: s.category, coverUrl: await mediaUrl(s.coverKey),
      artistName: s.artist.stageName, freeEpisodes: s.freeEpisodes, views: views.get(s.id) ?? 0,
      isNew: !!s.publishedAt && s.publishedAt.getTime() > twoWeeks,
    });
  }
  const card = (id: string) => cards.get(id)!;
  const featured = series.find((s) => s.featured) ?? series[0];
  const hot = [...series].sort((a, b) => (hotScore.get(b.id) ?? 0) - (hotScore.get(a.id) ?? 0) || (views.get(b.id) ?? 0) - (views.get(a.id) ?? 0)).slice(0, 10);
  const topRanking = sortByViews(ranking).filter((r) => r.views > 0).slice(0, 5);

  // "Continuar a ver": últimas séries que a pessoa estava a ver
  let continueWatching: { href: string; title: string; label: string; cover: string | null; pct: number }[] = [];
  if (user) {
    const progress = await db.watchProgress.findMany({
      where: { userId: user.id, episode: { published: true, series: { status: "PUBLISHED" } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { episode: { select: { id: true, number: true, durationSec: true, seriesId: true } } },
    });
    const seen = new Set<string>();
    for (const p of progress) {
      if (seen.has(p.episode.seriesId) || continueWatching.length >= 10) continue;
      seen.add(p.episode.seriesId);
      const s = series.find((x) => x.id === p.episode.seriesId);
      if (!s) continue;
      const nextEp = p.completed ? s.episodes.find((e) => e.number === p.episode.number + 1) : null;
      if (p.completed && !nextEp) continue; // série vista até ao fim
      continueWatching.push({
        href: `/ver/${nextEp ? nextEp.id : p.episode.id}`,
        title: s.title,
        label: nextEp ? `Episódio ${nextEp.number}` : `Episódio ${p.episode.number}`,
        cover: card(s.id).coverUrl,
        pct: nextEp ? 0 : p.episode.durationSec ? Math.min(100, Math.round((p.lastPosition / p.episode.durationSec) * 100)) : 0,
      });
    }
  }

  if (series.length === 0)
    return (
      <div className="container-app max-w-xl py-10">
        <h1 className="text-3xl font-bold">{brand.name}</h1>
        <EmptyState title="As primeiras séries estão a chegar" text={`${brand.slogan}. Volta em breve — ou, se fazes séries, publica aqui as tuas.`} action={{ href: "/artista/registar", label: "Quero publicar as minhas séries" }} />
      </div>
    );

  const featuredCover = featured ? card(featured.id).coverUrl : null;

  return (
    <div>
      {featured && (
        <section className="container-app">
          <div className="relative overflow-hidden rounded-3xl bg-surface">
            {featuredCover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featuredCover} alt="" className="absolute inset-x-0 top-0 h-3/5 w-full object-cover object-top opacity-60 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" />
            )}
            <div className="relative bg-gradient-to-t from-surface from-50% to-transparent p-5 pt-40 sm:p-8 sm:pt-56">
              <span className="badge-price">{CATEGORY_LABELS[featured.category]}</span>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{featured.title}</h1>
              <p className="mt-1 text-sm text-muted">de {featured.artist.stageName} · {featured.freeEpisodes} episódios grátis</p>
              <p className="mt-2 line-clamp-2 max-w-xl text-fg/90">{featured.synopsis}</p>
              <Link href={`/serie/${featured.slug}`} className="btn-primary mt-4">
                <IconPlay size={20} /> Ver grátis
              </Link>
            </div>
          </div>
        </section>
      )}

      {continueWatching.length > 0 && (
        <section className="mt-8">
          <h2 className="container-app text-xl font-bold">Continuar a ver</h2>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-auto md:max-w-5xl">
            {continueWatching.map((c) => (
              <Link key={c.href} href={c.href} className="flex w-64 shrink-0 gap-3 rounded-2xl bg-surface p-2 no-underline hover:bg-surface2">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-surface2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.cover && <img src={c.cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="truncate font-semibold text-fg">{c.title}</p>
                  <p className="flex items-center gap-1 text-xs text-accent2"><IconPlay size={10} /> {c.label}</p>
                  <div className="mt-2 h-1 rounded bg-white/10"><div className="h-full rounded bg-accent" style={{ width: `${c.pct}%` }} /></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <SeriesRow title="Em alta" items={hot.map((s) => card(s.id))} />
      <SeriesRow title="Novas" items={series.slice(0, 10).map((s) => card(s.id))} />
      {HOME_ROWS.map((cat) => (
        <SeriesRow key={cat} title={CATEGORY_LABELS[cat]} items={series.filter((s) => s.category === cat).map((s) => card(s.id))} />
      ))}

      {topRanking.length > 0 && (
        <section className="container-app mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold"><IconTrophy className="text-accent2" /> Disputa dos artistas</h2>
            <Link href="/ranking" className="text-sm font-semibold text-accent2 underline">Ver tudo</Link>
          </div>
          <div className="mt-3"><RankingList rows={topRanking} by="views" /></div>
        </section>
      )}

      <section className="container-app mt-8">
        <h2 className="text-xl font-bold">Todas as séries</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {series.map((s, i) => <SeriesCard key={s.id} s={card(s.id)} grid priority={i < 2} />)}
        </div>
      </section>

      <section className="container-app mt-12">
        <div className="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Fazes séries no TikTok ou no Instagram?</h2>
            <p className="text-sm text-muted">Publica aqui e ganha 50% de tudo o que o público pagar pelas tuas séries.</p>
          </div>
          <Link href="/artista/registar" className="btn-secondary">Quero ser artista</Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="container-app mt-12 border-t border-white/5 py-6 text-xs text-muted">
      <nav className="flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/legal/termos">Termos</Link>
        <Link href="/legal/privacidade">Privacidade</Link>
        <Link href="/legal/politica-artista">Política do Artista</Link>
        <Link href="/legal/acordo-artista">Acordo do Artista</Link>
      </nav>
      <p className="mt-3">© {new Date().getFullYear()} {brand.name}. Apoio: {brand.supportEmail} · WhatsApp {brand.supportWhatsapp}</p>
    </footer>
  );
}
