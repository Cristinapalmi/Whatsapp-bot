import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { CATEGORY_LABELS } from "@/lib/categories";
import { SeriesCard } from "@/components/SeriesCard";
import { RefTracker } from "@/components/RefTracker";
import { IconTrophy } from "@/components/icons";
import { topFans } from "@/domain/points";

export const dynamic = "force-dynamic";

/** Página pública do artista = o seu LINK PESSOAL (dominio/nome). */
async function load(slug: string) {
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) return null;
  return db.artistProfile.findFirst({
    where: { slug, status: "APPROVED" },
    include: { series: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await load((await params).slug);
  return a ? { title: a.stageName, description: `As séries de ${a.stageName} na ${brand.name}. Os primeiros episódios são grátis.` } : {};
}

export default async function ArtistPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const artist = await load((await params).slug);
  if (!artist) notFound();
  const [photo, fans] = await Promise.all([mediaUrl(artist.photoKey), topFans(db, artist.id, 3)]);
  const cards = await Promise.all(
    artist.series.map(async (s) => ({
      slug: s.slug, title: s.title, category: s.category, coverUrl: await mediaUrl(s.coverKey),
      artistName: artist.stageName, freeEpisodes: s.freeEpisodes,
    })),
  );

  return (
    <div className="container-app max-w-3xl">
      <RefTracker slug={artist.slug} />
      <section className="flex items-center gap-4 py-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-4xl font-bold text-accent">{artist.stageName[0]}</span>}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">{artist.stageName}</h1>
          <p className="text-muted">{CATEGORY_LABELS[artist.category]} · {artist.series.length} {artist.series.length === 1 ? "série" : "séries"}</p>
        </div>
      </section>
      <p className="rounded-2xl bg-surface p-4 text-fg/90">
        Bem-vindo! Os primeiros episódios são <strong className="text-ok">grátis</strong>. Cada episódio que desbloqueias apoia diretamente {artist.stageName}.
      </p>

      <h2 className="mt-8 text-xl font-bold">Séries</h2>
      {cards.length === 0 ? (
        <p className="mt-2 text-muted">As séries chegam em breve.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">{cards.map((c) => <SeriesCard key={c.slug} s={c} />)}</div>
      )}

      {fans.length > 0 && (
        <section className="card mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold"><IconTrophy size={20} className="text-accent2" /> Maiores fãs</h2>
          <ol className="mt-2 space-y-1">
            {fans.map((f, i) => (
              <li key={f.userId} className="flex justify-between text-sm">
                <span>{i === 0 ? <strong className="text-accent2">Fã n.º 1 · {f.displayName}</strong> : `${i + 1}. ${f.displayName}`}</span>
                <span className="text-muted">{f.points} pontos</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="mt-8 text-center"><Link href="/" className="btn-secondary">Ver todas as séries</Link></p>
    </div>
  );
}
