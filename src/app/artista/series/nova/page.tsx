import type { Metadata } from "next";
import { requireArtist } from "@/lib/artist";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { submitSeriesAction } from "./actions";

export const metadata: Metadata = { title: "Enviar nova série" };

export default async function NewSeriesPage() {
  const { artist } = await requireArtist({ approved: true });
  return (
    <div className="container-app max-w-xl">
      <h1 className="text-2xl font-bold">Enviar nova série</h1>
      <p className="mt-1 text-sm text-muted">Indica onde a série está publicada. A nossa equipa analisa, combina contigo os episódios grátis e o preço, e trata de carregar os vídeos.</p>
      <ActionForm action={submitSeriesAction} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="title">Nome da série</label>
          <input className="input" id="title" name="title" required />
        </div>
        <div>
          <label className="label" htmlFor="socialUrl">Link no TikTok ou Instagram</label>
          <input className="input" id="socialUrl" name="socialUrl" type="url" placeholder="https://www.tiktok.com/@..." required />
        </div>
        <div>
          <label className="label" htmlFor="plannedEpisodes">Número de episódios</label>
          <input className="input" id="plannedEpisodes" name="plannedEpisodes" type="number" inputMode="numeric" min={2} max={100} required />
        </div>
        <div>
          <label className="label" htmlFor="category">Categoria</label>
          <select className="input" id="category" name="category" defaultValue={artist.category}>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="synopsis">Sinopse (opcional)</label>
          <textarea className="input" id="synopsis" name="synopsis" rows={4} maxLength={600} />
        </div>
        <SubmitButton>Enviar para análise</SubmitButton>
      </ActionForm>
    </div>
  );
}
