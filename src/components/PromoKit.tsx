"use client";
import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { IconDownload } from "./icons";

/** Kit de promoção: imagem vertical para o estado/stories + texto pronto. */
export function PromoKit({ imageUrl, text, title, trailerUrl }: { imageUrl: string; text: string; title: string; trailerUrl: string | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function share() {
    setMsg(null);
    try {
      const blob = await fetch(imageUrl).then((r) => r.blob());
      const file = new File([blob], "kit.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title });
      else if (navigator.share) await navigator.share({ text, title });
      else {
        await navigator.clipboard.writeText(text);
        setMsg("Texto copiado. Descarrega a imagem e publica no teu estado.");
      }
    } catch {}
  }
  return (
    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Imagem para o estado" className="aspect-[9/16] w-40 rounded-xl bg-surface2 object-cover sm:w-full" loading="lazy" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <a href={`${imageUrl}?descarregar=1`} download className="btn-primary btn-sm no-underline"><IconDownload size={16} /> Descarregar</a>
          <button type="button" onClick={share} className="btn-secondary btn-sm">Partilhar</button>
          {trailerUrl && <a href={trailerUrl} download className="btn-secondary btn-sm no-underline"><IconDownload size={16} /> Trailer</a>}
        </div>
        <p className="whitespace-pre-line rounded-xl bg-surface2 p-3 text-sm">{text}</p>
        <CopyButton text={text} label="Copiar texto" showText buttonText="Copiar texto" />
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </div>
    </div>
  );
}
