import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { coinsLabel } from "@/lib/money";
import { episodePriceCoins } from "@/domain/coins/service";
import { CATEGORY_LABELS } from "@/lib/categories";
import { episodeStates, type EpisodeState } from "@/domain/access";
import { IconCheck, IconClock, IconLock, IconPlay, IconTrophy } from "@/components/icons";
import { topFans } from "@/domain/points";
import { ReportForm } from "./ReportForm";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return db.series.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      artist: { select: { stageName: true, slug: true, photoKey: true } },
      episodes: { where: { published: true }, orderBy: { number: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await load((await params).slug);
  return s ? { title: s.title, description: s.synopsis } : {};
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const series = await load((await params).slug);
  if (!series) notFound();
  const user = await getCurrentUser();
  const states = await episodeStates(db, user?.id ?? null, series, series.episodes);
  const cover = await mediaUrl(series.coverKey);
  const [fan1] = await topFans(db, series.artistId, 1);
  const priceCoins = await episodePriceCoins(db, series);
  const firstWatchable = series.episodes.find((e) => states[e.id] === "free" || states[e.id] === "unlocked");

  return (
    <div className="container-app">
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="mx-auto w-48 md:w-full">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-surface2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cover && <img src={cover} alt={`Capa de ${series.title}`} className="h-full w-full object-cover" />}
          </div>
        </div>
        <div>
          <span className="badge-price">{CATEGORY_LABELS[series.category]}</span>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{series.title}</h1>
          <p className="mt-1 text-muted">de <Link href={`/${series.artist.slug}`} className="font-semibold text-fg underline">{series.artist.stageName}</Link></p>
          <p className="mt-3 leading-relaxed text-fg/90">{series.synopsis}</p>
          <p className="mt-3 text-sm text-muted">
            {series.freeEpisodes} {series.freeEpisodes === 1 ? "episódio grátis" : "episódios grátis"} · depois {coinsLabel(priceCoins)} por episódio
          </p>
          {fan1 && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent2/15 px-3 py-1.5 text-sm text-accent2">
              <IconTrophy size={16} /> Fã n.º 1 de {series.artist.stageName}: <strong>{fan1.displayName}</strong> · {fan1.points} pontos
            </p>
          )}
          <div />
          {firstWatchable && (
            <Link href={`/ver/${firstWatchable.id}`} className="btn-primary mt-4">
              <IconPlay size={20} /> Ver episódio {firstWatchable.number}
            </Link>
          )}
        </div>
      </div>

      <h2 className="mt-10 text-xl font-bold">Episódios</h2>
      <ol className="mt-3 space-y-2">
        {series.episodes.map((e) => (
          <li key={e.id}>
            <Link href={`/ver/${e.id}`} className="card flex min-h-[64px] items-center gap-4 no-underline hover:bg-surface2">
              <span className="w-8 shrink-0 text-center font-display text-2xl font-bold text-muted">{e.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg">{e.title}</span>
                <span className="text-xs text-muted">{Math.max(1, Math.round(e.durationSec / 60))} min{e.endsWithHook ? " · termina em suspense" : ""}</span>
              </span>
              <StateBadge state={states[e.id]} price={priceCoins} />
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <ReportForm seriesId={series.id} loggedIn={!!user} />
      </div>
    </div>
  );
}

function StateBadge({ state, price }: { state: EpisodeState; price: number }) {
  switch (state) {
    case "free": return <span className="badge-free"><IconPlay size={12} />Grátis</span>;
    case "unlocked": return <span className="badge-unlocked"><IconCheck size={12} />Desbloqueado</span>;
    case "pending": return <span className="badge-pending"><IconClock size={12} />Pendente</span>;
    default: return <span className="badge-price"><IconLock size={12} />{coinsLabel(price)}</span>;
  }
}
