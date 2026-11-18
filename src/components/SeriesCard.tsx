import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/categories";
import type { Category } from "@prisma/client";
import { IconPlay } from "./icons";

export type SeriesCardData = {
  slug: string;
  title: string;
  category: Category;
  coverUrl: string | null;
  artistName: string;
  freeEpisodes: number;
  views?: number;
  isNew?: boolean;
};

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")} mil` : String(n));

/** Cartão de série. `grid` = ocupa a largura da coluna (grelha); senão, tamanho fixo (filas). */
export function SeriesCard({ s, priority, grid }: { s: SeriesCardData; priority?: boolean; grid?: boolean }) {
  return (
    <Link href={`/serie/${s.slug}`} className={`group block no-underline ${grid ? "w-full" : "w-36 shrink-0 sm:w-44"}`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface2">
        {s.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.coverUrl} alt="" loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-end p-3 font-display text-lg font-bold">{s.title}</div>
        )}
        <span className="badge-free absolute left-2 top-2 bg-black/70">{s.freeEpisodes} grátis</span>
        {s.isNew && <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-[#1A0E05]">Nova</span>}
        {!!s.views && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-fg">
            <IconPlay size={10} /> {compact(s.views)}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-fg">{s.title}</p>
      <p className="text-xs text-muted">{s.artistName} · {CATEGORY_LABELS[s.category]}</p>
    </Link>
  );
}

export function SeriesRow({ title, items, href }: { title: string; items: SeriesCardData[]; href?: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="container-app flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {href && <Link href={href} className="text-sm font-semibold text-accent2 underline">Ver tudo</Link>}
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-auto md:max-w-5xl">
        {items.map((s) => <SeriesCard key={s.slug} s={s} />)}
      </div>
    </section>
  );
}
