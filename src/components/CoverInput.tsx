"use client";
import { useRef, useState } from "react";

const W = 600;
const H = 900;

/**
 * Capa vertical com pré-visualização e RECORTE AUTOMÁTICO para 600×900:
 * a imagem é cortada ao centro no próprio telemóvel antes de ser enviada (fica leve e no formato certo).
 */
export function CoverInput({ current }: { current?: string | null }) {
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(file: File | undefined) {
    setMsg(null);
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setMsg("Escolhe uma imagem JPG, PNG ou WEBP.");
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      if (!blob) throw new Error();
      const cropped = new File([blob], "capa.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(cropped);
      if (inputRef.current) inputRef.current.files = dt.files;
      setPreview(URL.createObjectURL(cropped));
      if (img.width < W || img.height < H) setMsg("A imagem é pequena e pode ficar pouco nítida. Se tiveres uma maior, usa-a.");
    } catch {
      setMsg("Não consegui ler esta imagem. Tenta outra.");
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-surface2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="Pré-visualização da capa" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">Sem capa</span>}
      </div>
      <div className="min-w-0 flex-1">
        <label className="label" htmlFor="cover">Capa vertical</label>
        <input ref={inputRef} className="input" id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onChange(e.target.files?.[0])} />
        <p className="hint">Cortamos automaticamente para 600×900 (vertical). <strong className="text-fg">Usa só imagens tuas, sem marcas de outras apps.</strong></p>
        {msg && <p className="mt-1 text-xs text-warn">{msg}</p>}
      </div>
    </div>
  );
}
