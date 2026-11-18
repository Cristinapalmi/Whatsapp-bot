import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { SeriesCard } from "@/components/SeriesCard";
import { EmptyState } from "@/components/EmptyState";
import { IconBookmark } from "@/components/icons";

export const metadata: Metadata = { title: "A minha lista" };
export const dynamic = "force-dynamic";

export default async function MyListPage() {
  const user = await getCurrentUser();
  if (!user)
    return (
      <div className="container-app max-w-2xl">
        <h1 className="text-3xl font-bold">A minha lista</h1>
        <EmptyState icon={<IconBookmark size={24} />} title="Guarda as séries que queres ver" text="Entra na tua conta (é grátis) para guardar séries e voltar a elas quando quiseres." action={{ href: "/entrar?next=/lista", label: "Entrar ou criar conta" }} />
      </div>
    );
  const favs = await db.favorite.findMany({
    where: { userId: user.id, series: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    include: { series: { include: { artist: { select: { stageName: true } } } } },
  });
  const cards = await Promise.all(
    favs.map(async (f) => ({
      slug: f.series.slug, title: f.series.title, category: f.series.category, coverUrl: await mediaUrl(f.series.coverKey),
      artistName: f.series.artist.stageName, freeEpisodes: f.series.freeEpisodes,
    })),
  );
  return (
    <div className="container-app max-w-3xl">
      <h1 className="text-3xl font-bold">A minha lista</h1>
      {cards.length === 0 ? (
        <EmptyState icon={<IconBookmark size={24} />} title="A tua lista está vazia" text="Na página de uma série, carrega em “A minha lista” para a guardares aqui." action={{ href: "/", label: "Descobrir séries em alta" }} />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{cards.map((c) => <SeriesCard key={c.slug} s={c} grid />)}</div>
      )}
    </div>
  );
}
