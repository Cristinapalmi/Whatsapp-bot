"use client";
import { askLogin } from "@/lib/ask-login";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { completeAdAction, startAdAction } from "@/app/ver/[id]/ad-actions";
import { IconPlay, IconX } from "./icons";

type Ad = { viewId: string; videoUrl: string; durationSec: number; sponsor: string; linkUrl: string | null };

/** "Ver anúncio e desbloquear grátis (oferta única)" — o anúncio tem de ser visto até ao fim. */
export function AdUnlockButton({ episodeId, disabled, onUnlocked }: { episodeId: string; disabled?: boolean; onUnlocked?: () => void }) {
  const router = useRouter();
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxTime = useRef(0);

  async function open() {
    setError(null);
    setLoading(true);
    const r = await startAdAction(episodeId);
    setLoading(false);
    if (!r.ok) {
      if (r.code === "LOGIN") askLogin(`/ver/${episodeId}`);
      else setError(r.error);
      return;
    }
    maxTime.current = 0;
    setLeft(r.durationSec);
    setAd(r);
  }

  useEffect(() => {
    if (ad) videoRef.current?.play().catch(() => {});
  }, [ad]);

  async function finish(retry = 0) {
    if (!ad) return;
    setFinishing(true);
    const r = await completeAdAction(ad.viewId);
    if (r.ok) {
      setAd(null);
      if (onUnlocked) onUnlocked();
      else router.refresh();
      return;
    }
    // Pequenos atrasos de rede: espera um pouco e tenta outra vez
    if (r.code === "TOO_SOON" && retry < 3) {
      setTimeout(() => finish(retry + 1), 1500);
      return;
    }
    setFinishing(false);
    setAd(null);
    setError(r.error);
  }

  return (
    <>
      <button type="button" onClick={open} disabled={disabled || loading} className="btn-secondary w-full border border-accent2/50">
        <IconPlay size={18} /> {loading ? "A preparar o anúncio…" : "Ver anúncio e desbloquear grátis (oferta única)"}
      </button>
      {error && <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

      {ad && (
        <div role="dialog" aria-modal="true" aria-label="Anúncio" className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="rounded-full bg-white/10 px-3 py-1 text-fg">Anúncio · {ad.sponsor}</span>
            {left > 0 ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-fg">Desbloqueias em {Math.ceil(left)} s</span>
            ) : (
              <span className="rounded-full bg-ok/20 px-3 py-1 text-ok">{finishing ? "A desbloquear…" : "Pronto!"}</span>
            )}
            <button type="button" onClick={() => setAd(null)} aria-label="Fechar o anúncio (não desbloqueia)" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-fg">
              <IconX size={20} />
            </button>
          </div>
          <video
            ref={videoRef}
            src={ad.videoUrl}
            className="min-h-0 flex-1 bg-black object-contain"
            playsInline
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.currentTime > maxTime.current + 1.5) v.currentTime = maxTime.current; // não deixa saltar para a frente
              else maxTime.current = Math.max(maxTime.current, v.currentTime);
              setLeft(Math.max(0, (v.duration || ad.durationSec) - v.currentTime));
            }}
            onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
            onEnded={() => finish()}
          />
          <div className="flex items-center justify-between gap-3 p-3 text-xs text-muted">
            <span>Vê o anúncio até ao fim para desbloquear o episódio. Toca no vídeo para pausar.</span>
            {ad.linkUrl && (
              <a href={ad.linkUrl} target="_blank" rel="noreferrer noopener sponsored" onClick={() => videoRef.current?.pause()} className="btn-secondary btn-sm shrink-0 no-underline">
                Saber mais
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
