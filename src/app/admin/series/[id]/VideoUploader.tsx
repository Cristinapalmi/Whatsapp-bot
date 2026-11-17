"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconUpload } from "@/components/icons";
import { attachVideoAction, createVideoUploadAction } from "../../actions";

/** Lê a duração do vídeo no próprio navegador. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(Number.isFinite(v.duration) ? v.duration : 0); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

/** Envia o vídeo DIRETAMENTE para o armazenamento (R2), com barra de progresso. */
export function VideoUploader({ episodeId, quality, hasVideo, label }: { episodeId: string; quality: "low" | "medium"; hasVideo: boolean; label: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(file: File) {
    setMsg(null);
    if (file.size > 200 * 1024 * 1024) return setMsg("Ficheiro demasiado grande (máx. 200 MB). Comprime primeiro.");
    try {
      const duration = await readDuration(file);
      const { url, key } = await createVideoUploadAction(episodeId, quality, file.type || "video/mp4");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Erro ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Falha de rede"));
        xhr.send(file);
      });
      await attachVideoAction(episodeId, quality, key, duration);
      setMsg("Vídeo carregado.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro no envio.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="rounded-xl bg-surface2 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        {hasVideo ? <IconCheck size={16} className="text-ok" /> : <IconUpload size={16} />} {label}
      </p>
      <label className="btn-secondary btn-sm mt-2 w-full cursor-pointer">
        {hasVideo ? "Substituir vídeo" : "Escolher vídeo"}
        <input type="file" accept="video/mp4,video/webm" className="sr-only" disabled={progress !== null} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {progress !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded bg-bg" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
