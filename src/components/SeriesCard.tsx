import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/categories";
import type { Category } from "@prisma/client";

export type SeriesCardData = {
  slug: string;
  title: string;
  category: Category;
  coverUrl: string | null;
  artistName: string;
  freeEpisodes: number;
};

export function SeriesCard({ s, priority }: { s: SeriesCardData; priority?: boolean }) {
  return (
    <Link href={`/serie/${s.slug}`} className="group block w-36 shrink-0 no-underline sm:w-44">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface2">
        {s.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.coverUrl} alt="" loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-end p-3 font-display text-lg font-bold">{s.title}</div>
        )}
        <span className="badge-free absolute left-2 top-2 bg-black/70">{s.freeEpisodes} grátis</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-fg">{s.title}</p>
      <p className="text-xs text-muted">{s.artistName} · {CATEGORY_LABELS[s.category]}</p>
    </Link>
  );
}

export function SeriesRow({ title, items }: { title: string; items: SeriesCardData[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="container-app text-xl font-bold">{title}</h2>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-auto md:max-w-5xl">
        {items.map((s) => <SeriesCard key={s.slug} s={s} />)}
      </div>
    </section>
  );
}
