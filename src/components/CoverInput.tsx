"use client";
import { useState } from "react";

/** Escolher a capa vertical com pré-visualização. */
export function CoverInput({ current }: { current?: string | null }) {
  const [preview, setPreview] = useState<string | null>(current ?? null);
  return (
    <div className="flex items-start gap-3">
      <div className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-surface2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="Pré-visualização da capa" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">Sem capa</span>}
      </div>
      <div className="flex-1">
        <label className="label" htmlFor="cover">Capa vertical</label>
        <input
          className="input"
          id="cover"
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
          }}
        />
        <p className="hint">JPG, PNG ou WEBP, até 3 MB. Ideal: 600×900 (vertical).</p>
      </div>
    </div>
  );
}
