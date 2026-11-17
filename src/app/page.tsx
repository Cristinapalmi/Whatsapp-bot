import Link from "next/link";
import { brand } from "@config/brand";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { CATEGORY_LABELS, HOME_ROWS } from "@/lib/categories";
import { SeriesRow, type SeriesCardData } from "@/components/SeriesCard";
import { IconPlay, IconTrophy } from "@/components/icons";
import { RankingList } from "@/components/RankingList";
import { monthlyRanking, sortByViews } from "@/domain/ranking";

export const dynamic = "force-dynamic";

export default async function Home() {
  const series = await db.series.findMany({
    where: { status: "PUBLISHED" },
    include: { artist: { select: { stageName: true } } },
    orderBy: { publishedAt: "desc" },
  });

  // "Em alta": séries com mais segundos vistos nos últimos 7 dias
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const trending = await db.watchLog.groupBy({
    by: ["episodeId"],
    where: { day: { gte: since } },
    _sum: { seconds: true },
  });
  const epToSeries = new Map(
    (await db.episode.findMany({ where: { id: { in: trending.map((t) => t.episodeId) } }, select: { id: true, seriesId: true } })).map((e) => [e.id, e.seriesId]),
  );
  const scoreBySeries = new Map<string, number>();
  for (const t of trending) {
    const sid = epToSeries.get(t.episodeId);
    if (sid) scoreBySeries.set(sid, (scoreBySeries.get(sid) ?? 0) + (t._sum.seconds ?? 0));
  }

  const cards = new Map<string, SeriesCardData>();
  for (const s of series) {
    cards.set(s.id, {
      slug: s.slug, title: s.title, category: s.category, coverUrl: await mediaUrl(s.coverKey),
      artistName: s.artist.stageName, freeEpisodes: s.freeEpisodes,
    });
  }
  const ranking = sortByViews(await monthlyRanking(db)).filter((r) => r.views > 0).slice(0, 5);
  const featured = series.find((s) => s.featured) ?? series[0];
  const featuredCover = featured ? cards.get(featured.id)?.coverUrl : null;
  const hot = [...series].sort((a, b) => (scoreBySeries.get(b.id) ?? 0) - (scoreBySeries.get(a.id) ?? 0)).slice(0, 10);

  return (
    <div>
      {featured ? (
        <section className="container-app">
          <div className="relative overflow-hidden rounded-3xl bg-surface">
            {featuredCover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featuredCover} alt="" className="absolute inset-x-0 top-0 h-3/5 w-full object-cover object-top opacity-60 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" />
            )}
            <div className="relative bg-gradient-to-t from-surface from-50% to-transparent p-5 pt-40 sm:p-8 sm:pt-56">
              <span className="badge-price">{CATEGORY_LABELS[featured.category]}</span>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{featured.title}</h1>
              <p className="mt-1 text-sm text-muted">de {featured.artist.stageName}</p>
              <p className="mt-2 line-clamp-2 max-w-xl text-fg/90">{featured.synopsis}</p>
              <Link href={`/serie/${featured.slug}`} className="btn-primary mt-4">
                <IconPlay size={20} /> Ver grátis
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="container-app py-16 text-center">
          <h1 className="text-3xl font-bold">{brand.name}</h1>
          <p className="mt-2 text-muted">{brand.slogan}. As primeiras séries chegam em breve.</p>
        </section>
      )}

      <SeriesRow title="Em alta" items={hot.map((s) => cards.get(s.id)!)} />
      {HOME_ROWS.map((cat) => (
        <SeriesRow key={cat} title={CATEGORY_LABELS[cat]} items={series.filter((s) => s.category === cat).map((s) => cards.get(s.id)!)} />
      ))}
      <SeriesRow title="Novidades" items={series.slice(0, 10).map((s) => cards.get(s.id)!)} />

      {ranking.length > 0 && (
        <section className="container-app mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold"><IconTrophy className="text-accent2" /> Disputa dos artistas</h2>
            <Link href="/ranking" className="text-sm font-semibold text-accent2 underline">Ver tudo</Link>
          </div>
          <div className="mt-3"><RankingList rows={ranking} by="views" /></div>
        </section>
      )}

      <section className="container-app mt-12">
        <div className="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Fazes séries no TikTok ou no Instagram?</h2>
            <p className="text-sm text-muted">Publica aqui e ganha 50% de tudo o que o público paga pelas tuas séries.</p>
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
