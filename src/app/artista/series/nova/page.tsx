import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { SeriesDetailsFields } from "@/components/SeriesDetailsFields";
import { createSeriesAction } from "../actions";

export const metadata: Metadata = { title: "Nova série" };
export const dynamic = "force-dynamic";

export default async function NewSeriesPage() {
  const { artist } = await requireArtist({ approved: true });
  // Série vs episódio: se outra série tem só 1 episódio, talvez a pessoa queira antes adicionar um episódio
  const lonely = await db.series.findFirst({
    where: { artistId: artist.id, status: { in: ["DRAFT", "REJECTED", "IN_REVIEW", "PUBLISHED"] } },
    include: { _count: { select: { episodes: true } } },
    orderBy: { createdAt: "desc" },
  });
  const suggest = lonely && lonely._count.episodes <= 1 ? lonely : null;

  return (
    <div className="container-app max-w-xl">
      <Link href="/artista" className="text-sm text-muted">← Painel</Link>
      <h1 className="mt-1 text-2xl font-bold">Nova série</h1>
      <p className="mt-1 text-sm text-muted">Uma <strong className="text-fg">série</strong> é a história completa (com título e capa). Depois de a criares, adicionas os <strong className="text-fg">episódios</strong> (1, 2, 3…), cada um com o seu vídeo.</p>
      {suggest && (
        <div className="card mt-4 border border-accent2/40">
          <p className="font-semibold text-accent2">Queres antes adicionar um episódio à série “{suggest.title}”?</p>
          <p className="mt-1 text-sm text-muted">Essa série tem só {suggest._count.episodes} episódio. Se o vídeo novo é a continuação da mesma história, adiciona-o lá como episódio seguinte.</p>
          <Link href={`/artista/series/${suggest.id}#novo-episodio`} className="btn-secondary btn-sm mt-3 no-underline">Adicionar episódio a “{suggest.title}”</Link>
        </div>
      )}
      <ActionForm action={createSeriesAction} className="mt-5 space-y-4">
        <SeriesDetailsFields defaultCategory={artist.category} />
        <SubmitButton pendingText="A criar…">Criar série</SubmitButton>
      </ActionForm>
    </div>
  );
}
