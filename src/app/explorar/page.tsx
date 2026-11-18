import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { SeriesCard } from "@/components/SeriesCard";
import { featuredCreators, hotSeries, recentEpisodes } from "@/domain/catalog";

export const metadata: Metadata = { title: "Explorar" };
export const dynamic = "force-dynamic";

const TABS = [["em-alta", "Em alta"], ["novos", "Novos episódios"], ["criadores", "Criadores"]] as const;

export default async function Explore({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const tab = TABS.find(([k]) => k === ver)?.[0] ?? "em-alta";
  return (
    <div className="container-app">
      <h1 className="text-2xl font-bold">Explorar</h1>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/explorar?ver=${k}`} className={`shrink-0 no-underline ${k === tab ? "btn-primary btn-sm" : "btn-secondary btn-sm"}`}>{label}</Link>
        ))}
      </div>
      {tab === "em-alta" && <Hot />}
      {tab === "novos" && <NewEpisodes />}
      {tab === "criadores" && <Creators />}
    </div>
  );
}

async function Hot() {
  const list = await hotSeries(db, 100);
  if (!list.length) return <Empty text="As primeiras séries estão a chegar. Fica atento à KONTA!" />;
  const covers = await Promise.all(list.map((s) => mediaUrl(s.coverKey)));
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {list.map((s, i) => (
        <SeriesCard key={s.id} grid priority={i < 2} s={{ slug: s.slug, title: s.title, category: s.category, coverUrl: covers[i], artistName: s.artist.stageName, freeEpisodes: s.freeEpisodes, views: s.views }} />
      ))}
    </div>
  );
}

async function NewEpisodes() {
  const eps = await recentEpisodes(db, 60);
  if (!eps.length) return <Empty text="Ainda não existem episódios publicados. Volta em breve para descobrires as novidades!" />;
  const covers = await Promise.all(eps.map((e) => mediaUrl(e.series.coverKey)));
  return (
    <ul className="mt-4 space-y-2">
      {eps.map((e, i) => (
        <li key={e.id}>
          <Link href={`/ver/${e.id}`} className="card flex items-center gap-3 no-underline hover:bg-surface2">
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-surface2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {covers[i] && <img src={covers[i]!} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-fg">{e.series.title} — Episódio {e.number}</p>
              <p className="text-xs text-muted">{e.series.artist.stageName}{e.number <= e.series.freeEpisodes ? " · grátis" : ""}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Creators() {
  const list = await featuredCreators(db, 100);
  if (!list.length) return <Empty text="Os primeiros criadores KONTA serão apresentados aqui." />;
  const photos = await Promise.all(list.map((c) => mediaUrl(c.photoKey)));
  return (
    <ul className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {list.map((c, i) => (
        <li key={c.id}>
          <Link href={`/${c.slug}`} className="flex flex-col items-center text-center no-underline">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-surface2 ring-2 ring-accent/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photos[i] ? <img src={photos[i]!} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-2xl font-bold text-accent">{c.stageName[0]}</span>}
            </div>
            <p className="mt-1 line-clamp-1 text-sm font-semibold text-fg">{c.stageName}</p>
            {c.founderNumber && <span className="text-[10px] font-semibold text-accent2">⭐ Fundador</span>}
            <span className="text-[11px] text-muted">{c._count.series} {c._count.series === 1 ? "série" : "séries"} · {c._count.followers} seguidores</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const Empty = ({ text }: { text: string }) => <p className="mt-6 rounded-2xl border border-dashed border-white/15 bg-surface p-6 text-center text-sm text-muted">{text}</p>;
