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
import { topSpenders } from "@/domain/artists/growth";
import { monthlyKing } from "@/domain/creator-ranking";
import { getCurrentUser } from "@/lib/auth";
import { FollowButton } from "@/components/FollowButton";

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
  const user = await getCurrentUser();
  const [photo, fans, followers, isFollowing] = await Promise.all([
    mediaUrl(artist.photoKey),
    topSpenders(db, artist.id, 10),
    db.follow.count({ where: { artistId: artist.id } }),
    user ? db.follow.findUnique({ where: { userId_artistId: { userId: user.id, artistId: artist.id } } }).then(Boolean) : false,
  ]);
  const crowned = artist.series.some((s) => s.crownedAt);
  const king = await monthlyKing(db);
  const isKing = king?.artistId === artist.id;
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
          <h1 className="text-3xl font-extrabold">{artist.stageName}{crowned ? " 👑" : ""}</h1>
          <p className="text-muted">{CATEGORY_LABELS[artist.category]} · {artist.series.length} {artist.series.length === 1 ? "série" : "séries"}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {isKing && <span className="badge-price">👑 Rei/Rainha da KONTA</span>}
            {artist.founderNumber && <span className="badge-free">⭐ Artista Fundador</span>}
            {artist.verifiedAt && <span className="badge-unlocked">✓ Verificado</span>}
          </div>
        </div>
      </section>
      {user?.id !== artist.userId && <FollowButton artistId={artist.id} initial={isFollowing} count={followers} next={`/${artist.slug}`} />}
      {artist.bio && <p className="mt-3 text-fg/90">{artist.bio}</p>}
      {(artist.tiktokUrl || artist.instagramUrl) && (
        <p className="mt-2 flex gap-3 text-sm">
          {artist.tiktokUrl && <a href={artist.tiktokUrl} target="_blank" rel="noreferrer nofollow" className="text-accent2 underline">TikTok</a>}
          {artist.instagramUrl && <a href={artist.instagramUrl} target="_blank" rel="noreferrer nofollow" className="text-accent2 underline">Instagram</a>}
        </p>
      )}
      <p className="mt-4 rounded-2xl bg-surface p-4 text-fg/90">
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
          <h2 className="flex items-center gap-2 text-lg font-bold"><IconTrophy size={20} className="text-accent2" /> Superfãs de {artist.stageName}</h2>
          <p className="text-xs text-muted">Os 10 fãs que mais apoiam. Ganham o selo ⭐ Superfã.</p>
          <ol className="mt-2 space-y-1">
            {fans.map((f, i) => (
              <li key={f.userId} className="flex justify-between text-sm">
                <span>{i === 0 ? <strong className="text-accent2">Fã n.º 1 · {f.displayName}</strong> : `${i + 1}. ${f.displayName}`}</span>
                <span className="text-accent2">⭐ Superfã</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="mt-8 text-center"><Link href="/" className="btn-secondary">Ver todas as séries</Link></p>
    </div>
  );
}
