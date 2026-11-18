"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconUpload } from "./icons";

type Start = (contentType: string, size: number) => Promise<{ ok: true; key: string; url: string } | { ok: false; error: string }>;
type Finish = (key: string, durationSec: number) => Promise<{ ok: true } | { ok: false; error: string }>;

const MAX = 50 * 1024 * 1024;

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(Number.isFinite(v.duration) ? v.duration : 0); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

/** Envio de vídeo direto para o armazenamento, com barra de progresso e limite bem explicado. */
export function DirectVideoUpload({ start, finish, hasVideo, label, maxMb, maxSec }: { start: Start; finish: Finish; hasVideo: boolean; label: string; maxMb?: number; maxSec?: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(file: File) {
    setMsg(null);
    if (!["video/mp4", "video/webm"].includes(file.type)) return setMsg({ ok: false, text: "Escolhe um vídeo MP4." });
    if (maxMb && file.size > maxMb * 1048576)
      return setMsg({ ok: false, text: `Este vídeo tem ${(file.size / 1048576).toFixed(1)} MB e o máximo é ${maxMb} MB.` });
    if (file.size > MAX)
      return setMsg({ ok: false, text: `Este vídeo tem ${(file.size / 1048576).toFixed(1)} MB e o máximo é 50 MB. Grava ou exporta em 360p/480p (no CapCut: Exportar → 480p) e tenta outra vez.` });
    const duration = await readDuration(file);
    if (maxSec && duration > maxSec + 0.5) return setMsg({ ok: false, text: `Este vídeo tem ${Math.round(duration)} s e o máximo é ${maxSec} s.` });
    const s = await start(file.type, file.size);
    if (!s.ok) return setMsg({ ok: false, text: s.error });
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", s.url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Erro ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Falha de rede. Verifica a internet e tenta outra vez."));
        xhr.send(file);
      });
      const f = await finish(s.key, duration);
      if (!f.ok) throw new Error(f.error);
      setMsg({ ok: true, text: "Vídeo carregado." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erro no envio." });
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="rounded-xl bg-surface2 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">{hasVideo ? <IconCheck size={16} className="text-ok" /> : <IconUpload size={16} />} {label}</p>
      <p className="mt-1 text-xs text-muted">MP4 vertical (9:16), até 50 MB (cerca de 3 min em 480p).</p>
      <label className={`btn-secondary btn-sm mt-2 w-full cursor-pointer ${progress !== null ? "pointer-events-none opacity-60" : ""}`}>
        {progress !== null ? `A enviar… ${progress}%` : hasVideo ? "Substituir vídeo" : "Escolher vídeo"}
        <input type="file" accept="video/mp4,video/webm" className="sr-only" disabled={progress !== null} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {progress !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded bg-bg" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
