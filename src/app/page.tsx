import Link from "next/link";
import { brand } from "@config/brand";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { CATEGORY_LABELS, HOME_ROWS } from "@/lib/categories";
import { SeriesCard, SeriesRow, type SeriesCardData } from "@/components/SeriesCard";
import { IconCalendar, IconChevronRight, IconFire, IconPlay, IconStar, IconTrophy } from "@/components/icons";
import { BannerCarousel, BrandBackdrop, type BannerSlideView } from "@/components/BannerCarousel";
import { activeSlides, ctaHref } from "@/domain/banner";
import { featuredCreators, hotSeries, recentEpisodes } from "@/domain/catalog";
import { EmptyState } from "@/components/EmptyState";
import { creatorRanking, monthlyKing, sortRanking, weekRange } from "@/domain/creator-ranking";

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
  const [viewsByEp, trending] = await Promise.all([
    db.watchProgress.groupBy({ by: ["episodeId"], _count: { _all: true } }),
    db.watchLog.groupBy({ by: ["episodeId"], where: { day: { gte: since } }, _sum: { seconds: true } }),
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
  const [king, weekRows] = await Promise.all([monthlyKing(db), creatorRanking(db, weekRange())]);
  const topCreators = sortRanking(weekRows, "fans").slice(0, 5);

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

  // ---------- dados das secções novas (sempre reais) ----------
  const [slidesRaw, hotList, newEps, creators, creatorsImgSetting, isArtist] = await Promise.all([
    activeSlides(db),
    hotSeries(db, 10),
    recentEpisodes(db, 10),
    featuredCreators(db, 12),
    db.setting.findUnique({ where: { key: "creatorsImageKey" } }),
    user ? db.artistProfile.findUnique({ where: { userId: user.id }, select: { id: true } }).then(Boolean) : false,
  ]);
  const slides: BannerSlideView[] = slidesRaw.length
    ? await Promise.all(slidesRaw.map(async (x) => ({ id: x.id, title: x.title, subtitle: x.subtitle, ctaText: x.ctaText, href: ctaHref(x), imageUrl: await mediaUrl(x.imageKey), videoUrl: await mediaUrl(x.videoKey) })))
    : [{
        id: "padrao",
        title: "MINISSÉRIES ANGOLANAS",
        subtitle: "As histórias que vais querer ver até ao fim. Descobre minisséries angolanas, acompanha os teus criadores favoritos e não percas nenhum episódio.",
        ctaText: "Descobrir séries",
        href: "/explorar?ver=em-alta",
        imageUrl: null,
        videoUrl: null,
      }];
  const newEpCovers = await Promise.all(newEps.map((e) => mediaUrl(e.series.coverKey)));
  const creatorPhotos = await Promise.all(creators.map((c) => mediaUrl(c.photoKey)));
  const creatorsImg = await mediaUrl(creatorsImgSetting?.value);
  const ago = (d: Date | null) => {
    if (!d) return "";
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days <= 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
  };

  return (
    <div>
      {/* 1. Banner */}
      <BannerCarousel slides={slides} />

      {/* 2. Escolhe a tua entrada */}
      <section className="container-app mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Escolhe a tua entrada</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Link href="/explorar?ver=em-alta" className="rounded-2xl border border-white/10 bg-surface p-4 no-underline transition hover:border-accent">
            <IconPlay size={22} className="text-accent" />
            <p className="mt-2 font-display text-base font-extrabold leading-tight text-fg">Quero assistir</p>
            <p className="mt-1 text-xs text-muted">Descobre minisséries angolanas</p>
          </Link>
          <Link href={isArtist ? "/artista" : "/criadores"} className="rounded-2xl border border-accent2/40 bg-gradient-to-br from-accent2/15 to-surface p-4 no-underline transition hover:border-accent2">
            <IconTrophy size={22} className="text-accent2" />
            <p className="mt-2 font-display text-base font-extrabold leading-tight text-fg">{isArtist ? "Ir para o meu painel" : "Quero ganhar com as minhas séries"}</p>
            <p className="mt-1 text-xs text-muted">{isArtist ? "Os teus ganhos, séries e fãs" : "Publica, conquista e monetiza"}</p>
          </Link>
        </div>
      </section>

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

      {/* 3. Em alta */}
      <SectionHead icon={<IconFire size={20} className="text-accent" />} title="Em alta" href="/explorar?ver=em-alta" link="Ver todas" />
      {hotList.length ? (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-auto md:max-w-5xl">
          {hotList.map((s) => <SeriesCard key={s.id} s={card(s.id)} />)}
        </div>
      ) : (
        <EmptyCard text="As primeiras séries estão a chegar. Fica atento à KONTA!" />
      )}

      {/* 4. Novos episódios */}
      <SectionHead icon={<IconCalendar size={20} className="text-accent2" />} title="Novos episódios" href="/explorar?ver=novos" link="Ver todas" />
      {newEps.length ? (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-auto md:max-w-5xl">
          {newEps.map((e, k) => (
            <Link key={e.id} href={`/ver/${e.id}`} className="flex w-60 shrink-0 gap-3 rounded-2xl bg-surface p-2 no-underline hover:bg-surface2">
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {newEpCovers[k] && <img src={newEpCovers[k]!} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="truncate font-semibold text-fg">{e.series.title}</p>
                <p className="text-xs text-accent2">Episódio {e.number}{e.number <= e.series.freeEpisodes ? " · grátis" : ""}</p>
                <p className="text-[11px] text-muted">{e.series.artist.stageName} · {ago(e.publishedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyCard text="Ainda não existem episódios publicados. Volta em breve para descobrires as novidades!" />
      )}

      {/* 5. Criadores em destaque */}
      <SectionHead icon={<IconStar size={20} className="text-accent2" />} title="Criadores em destaque" href="/explorar?ver=criadores" link="Ver todos" />
      {creators.length ? (
        <div className="no-scrollbar mt-3 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-auto md:max-w-5xl">
          {creators.map((c, k) => (
            <Link key={c.id} href={`/${c.slug}`} className="flex w-24 shrink-0 flex-col items-center text-center no-underline">
              <div className="h-20 w-20 overflow-hidden rounded-full bg-surface2 ring-2 ring-accent/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {creatorPhotos[k] ? <img src={creatorPhotos[k]!} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-2xl font-bold text-accent">{c.stageName[0]}</span>}
              </div>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-fg">{king?.artistId === c.id ? "👑 " : ""}{c.stageName}</p>
              {c.founderNumber && <span className="text-[10px] font-semibold text-accent2">⭐ Fundador</span>}
              <span className="text-[11px] text-muted">{c._count.series} {c._count.series === 1 ? "série" : "séries"}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="container-app mt-3">
          <div className="flex gap-4">{[0, 1, 2, 3].map((k) => <div key={k} className="h-16 w-16 rounded-full border-2 border-dashed border-white/15" />)}</div>
          <p className="mt-2 text-sm text-muted">Os primeiros criadores KONTA serão apresentados aqui.</p>
        </div>
      )}

      {/* 6. Área dos criadores (não aparece a quem já é artista) */}
      {!isArtist && (
        <section className="container-app mt-8">
          <div className="relative grid overflow-hidden rounded-3xl border border-accent2/30 bg-gradient-to-br from-surface via-surface to-accent/20 sm:grid-cols-[1fr_260px]">
            <div className="relative z-10 p-5 sm:p-7">
              <span className="rounded-full bg-accent2/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent2">Área dos criadores</span>
              <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight text-fg sm:text-3xl">A tua história pode valer muito mais.</h2>
              <p className="mt-2 text-sm text-fg/85">Transforma as tuas minisséries numa fonte de rendimento.</p>
              <Link href="/criadores" className="btn-primary mt-4 no-underline">Quero ser criador KONTA</Link>
              <p className="mt-3 text-xs font-semibold text-accent2">Publica. Conquista. Monetiza.</p>
            </div>
            <div className="relative h-56 sm:h-auto">
              {creatorsImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creatorsImg} alt="Criador KONTA" className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
              ) : (
                <BrandBackdrop />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-surface/70 to-transparent sm:bg-gradient-to-r sm:from-surface sm:via-transparent" />
              {/* decoração: moedas Kz e seta de crescimento */}
              <span className="absolute left-4 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-accent2 font-bold text-[#1A0E05] shadow-lg" aria-hidden>Kz</span>
              <span className="absolute bottom-8 left-10 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-[#1A0E05] shadow-lg" aria-hidden>Kz</span>
              <svg className="absolute right-4 top-4 h-14 w-14 text-ok drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
            </div>
          </div>
        </section>
      )}

      {HOME_ROWS.map((cat) => (
        <SeriesRow key={cat} title={CATEGORY_LABELS[cat]} items={series.filter((s) => s.category === cat).map((s) => card(s.id))} />
      ))}

      {/* Ranking dos criadores (por fãs — nunca por dinheiro) e Rei/Rainha da KONTA */}
      {(king || topCreators.length > 0) && (
        <section className="container-app mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold"><IconTrophy className="text-accent2" /> Ranking dos criadores</h2>
            <Link href="/ranking" className="text-sm font-semibold text-accent2 underline">Ver tudo</Link>
          </div>
          {king && (
            <Link href={`/${king.slug}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-accent2/50 bg-gradient-to-r from-accent2/25 to-surface p-3 no-underline">
              <span className="text-3xl" aria-hidden>👑</span>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-accent2">Rei/Rainha da KONTA do mês</p><p className="font-display text-lg font-extrabold text-fg">{king.stageName}</p></div>
            </Link>
          )}
          <ol className="mt-2 space-y-1.5">
            {topCreators.map((r, i) => (
              <li key={r.artistId}><Link href={`/${r.slug}`} className="card flex items-center justify-between py-2 no-underline hover:bg-surface2"><span className="text-fg"><strong className="mr-2 text-accent">{i + 1}</strong>{r.stageName}</span><span className="text-xs text-muted">{r.fans.toLocaleString("pt-AO")} {r.fans === 1 ? "fã" : "fãs"} esta semana</span></Link></li>
            ))}
          </ol>
        </section>
      )}

      {series.length > 0 && <section className="container-app mt-8">
        <h2 className="text-xl font-bold">Todas as séries</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {series.map((s, i) => <SeriesCard key={s.id} s={card(s.id)} grid priority={i < 2} />)}
        </div>
      </section>}

      <Footer />
    </div>
  );
}

function SectionHead({ icon, title, href, link }: { icon: React.ReactNode; title: string; href: string; link: string }) {
  return (
    <div className="container-app mt-8 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-xl font-bold">{icon} {title}</h2>
      <Link href={href} className="flex items-center text-sm font-semibold text-accent2 no-underline">{link} <IconChevronRight size={16} /></Link>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="container-app mt-3">
      <p className="rounded-2xl border border-dashed border-white/15 bg-surface p-5 text-center text-sm text-muted">{text}</p>
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
