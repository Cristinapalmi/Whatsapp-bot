import Link from "next/link";
import type { Metadata } from "next";
import { requireArtist } from "@/lib/artist";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CoverInput } from "@/components/CoverInput";
import { createSeriesAction } from "../actions";

export const metadata: Metadata = { title: "Nova série" };

export default async function NewSeriesPage() {
  const { artist } = await requireArtist({ approved: true });
  return (
    <div className="container-app max-w-xl">
      <Link href="/artista" className="text-sm text-muted">← Painel</Link>
      <h1 className="mt-1 text-2xl font-bold">Nova série</h1>
      <p className="mt-1 text-sm text-muted">Primeiro os dados da série. A seguir adicionas os episódios e os vídeos. Só aparece no catálogo depois de enviares para revisão e a equipa aprovar.</p>
      <ActionForm action={createSeriesAction} className="mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="title">Título</label>
          <input className="input" id="title" name="title" required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="synopsis">Sinopse</label>
          <textarea className="input" id="synopsis" name="synopsis" rows={4} maxLength={600} placeholder="Em 2 ou 3 frases: de que trata a série?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="category">Categoria</label>
            <select className="input" id="category" name="category" defaultValue={artist.category}>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="plannedEpisodes">Episódios previstos</label>
            <input className="input" id="plannedEpisodes" name="plannedEpisodes" type="number" inputMode="numeric" min={1} max={200} defaultValue={10} required />
          </div>
        </div>
        <CoverInput />
        <SubmitButton pendingText="A criar…">Criar série</SubmitButton>
      </ActionForm>
    </div>
  );
}
