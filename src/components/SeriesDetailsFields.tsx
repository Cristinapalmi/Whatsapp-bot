import type { Series } from "@prisma/client";
import { AGE_LABELS, ALL_CATEGORIES, CATEGORY_LABELS, LANGUAGE_LABELS, SERIES_TAGS } from "@/lib/categories";
import { CoverInput } from "./CoverInput";

/** Campos da série (nova série e edição), pensados para telemóvel. */
export function SeriesDetailsFields({ s, coverUrl, defaultCategory }: { s?: Pick<Series, "title" | "synopsis" | "category" | "ageRating" | "language" | "tags">; coverUrl?: string | null; defaultCategory?: string }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="title">Título</label>
        <input className="input" id="title" name="title" defaultValue={s?.title} required maxLength={80} />
      </div>
      <div>
        <label className="label" htmlFor="synopsis">Sinopse</label>
        <textarea className="input" id="synopsis" name="synopsis" rows={4} maxLength={600} defaultValue={s?.synopsis} placeholder="Em 2 ou 3 frases: de que trata a série? Deixa o público curioso." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="category">Categoria</label>
          <select className="input" id="category" name="category" defaultValue={s?.category ?? defaultCategory}>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ageRating">Classificação</label>
          <select className="input" id="ageRating" name="ageRating" defaultValue={s?.ageRating ?? "ALL"}>
            {Object.entries(AGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="language">Idioma</label>
        <select className="input" id="language" name="language" defaultValue={s?.language ?? "PT"}>
          {Object.entries(LANGUAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="label">Etiquetas (até 6)</legend>
        <div className="flex flex-wrap gap-2">
          {SERIES_TAGS.map((t) => (
            <label key={t} className="cursor-pointer rounded-full border border-white/15 px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/15 has-[:checked]:text-accent">
              <input type="checkbox" name="tags" value={t} defaultChecked={s?.tags.includes(t)} className="sr-only" /> {t}
            </label>
          ))}
        </div>
      </fieldset>
      <CoverInput current={coverUrl} />
    </>
  );
}
