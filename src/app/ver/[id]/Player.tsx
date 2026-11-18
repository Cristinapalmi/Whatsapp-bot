"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconGauge, IconNext, IconPause, IconPlay, IconSubtitles, IconExpand, IconClock, IconGift, IconStar } from "@/components/icons";
import { UnlockPanel } from "@/components/UnlockPanel";
import { sendGiftAction } from "./actions";
import type { EpisodeState } from "@/domain/access";

type Props = {
  episodeId: string;
  poster: string | null;
  loggedIn: boolean;
  isLastFree: boolean;
  endsWithHook: boolean;
  hookText: string | null;
  next: { id: string; number: number; state: EpisodeState } | null;
  hasSubtitles: boolean;
  artist: { id: string; slug: string; name: string };
  gifts: { code: string; label: string; emoji: string; priceCoins: number }[];
  priceCoins: number;
  balance: number;
  points: number;
  pointsCost: number;
  adOffer: boolean;
  /** Este episódio foi desbloqueado com a oferta do anúncio. */
  adUnlocked: boolean;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Leitor de vídeo leve:
 * - Nada é descarregado antes de o utilizador carregar em play (poupa dados).
 * - Modo "poupar dados" (360p) ligado por defeito.
 * - Envia o progresso ao servidor a cada 15 s (para minutos vistos e ranking).
 */
export function Player(p: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<{ url: string; subtitles: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSaver, setDataSaver] = useState(true);
  const [subs, setSubs] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showGifts, setShowGifts] = useState(false);
  const [giftPending, setGiftPending] = useState(false);
  const [giftMsg, setGiftMsg] = useState<{ ok: boolean; text: string; buy?: boolean } | null>(null);

  async function sendGift(code: string) {
    if (!p.loggedIn) {
      window.location.href = `/entrar?next=${encodeURIComponent(`/ver/${p.episodeId}`)}`;
      return;
    }
    const g = p.gifts.find((x) => x.code === code);
    if (!g || !window.confirm(`Oferecer ${g.emoji} ${g.label} a ${p.artist.name} por ${g.priceCoins} moedas?`)) return;
    setGiftPending(true);
    setGiftMsg(null);
    const r = await sendGiftAction(p.artist.id, code);
    setGiftPending(false);
    setGiftMsg(r.ok ? { ok: true, text: r.message ?? "Presente entregue!" } : { ok: false, text: r.error, buy: r.code === "INSUFFICIENT_COINS" });
  }
  const lastSent = useRef(0);
  const watchedSinceLastPing = useRef(0);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("dataSaver");
      if (v === "0") setDataSaver(false);
    } catch {}
  }, []);

  const sendProgress = useCallback(
    (completed = false) => {
      if (!p.loggedIn) return;
      const seconds = Math.round(watchedSinceLastPing.current);
      if (seconds <= 0 && !completed) return;
      watchedSinceLastPing.current = 0;
      const body = JSON.stringify({ seconds, position: Math.round(videoRef.current?.currentTime ?? 0), completed });
      if (navigator.sendBeacon && completed === false && document.visibilityState === "hidden") {
        navigator.sendBeacon(`/api/progress/${p.episodeId}`, new Blob([body], { type: "application/json" }));
      } else {
        fetch(`/api/progress/${p.episodeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
          .then((r) => r.json())
          .then((d) => {
            if (d?.points > 0) {
              setToast(`+${d.points} pontos de fã`);
              setTimeout(() => setToast(null), 4000);
            }
          })
          .catch(() => {});
      }
    },
    [p.episodeId, p.loggedIn],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && sendProgress();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [sendProgress]);

  async function start() {
    setError(null);
    if (src) {
      await videoRef.current?.play().catch(() => {});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/play/${p.episodeId}?q=${dataSaver ? "low" : "medium"}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar o vídeo.");
      setSrc({ url: data.url, subtitles: data.subtitles });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (src) videoRef.current?.play().catch(() => {});
  }, [src]);

  function toggle() {
    const v = videoRef.current;
    if (!src || !v) return start();
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function onTimeUpdate() {
    const v = videoRef.current!;
    setTime(v.currentTime);
    const now = performance.now();
    if (lastTick.current !== null && !v.paused) {
      const delta = (now - lastTick.current) / 1000;
      if (delta > 0 && delta < 5) watchedSinceLastPing.current += delta * v.playbackRate;
    }
    lastTick.current = now;
    if (now - lastSent.current > 15000) {
      lastSent.current = now;
      sendProgress();
    }
  }

  function toggleDataSaver() {
    const nextVal = !dataSaver;
    setDataSaver(nextVal);
    try { localStorage.setItem("dataSaver", nextVal ? "1" : "0"); } catch {}
    if (src) {
      // recarrega na nova qualidade, mantendo a posição
      const pos = videoRef.current?.currentTime ?? 0;
      fetch(`/api/play/${p.episodeId}?q=${nextVal ? "low" : "medium"}`).then((r) => r.json()).then((d) => {
        if (d.url) {
          setSrc({ url: d.url, subtitles: d.subtitles });
          setTimeout(() => { if (videoRef.current) videoRef.current.currentTime = pos; }, 300);
        }
      });
    }
  }

  const showAdUpsell = ended && p.adUnlocked && (!p.next || p.next.state === "locked");
  const showHook = !showAdUpsell && ended && p.next && (p.next.state === "locked" || p.next.state === "pending") && (p.isLastFree || p.endsWithHook);
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div className="mt-2">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        {src ? (
          <video
            ref={videoRef}
            className="h-full w-full"
            src={src.url}
            playsInline
            preload="metadata"
            poster={p.poster ?? undefined}
            onPlay={() => { setPlaying(true); setEnded(false); lastTick.current = performance.now(); }}
            onPause={() => { setPlaying(false); lastTick.current = null; sendProgress(); }}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => { setEnded(true); setPlaying(false); sendProgress(true); }}
            onError={() => setError("Não foi possível reproduzir. Verifica a tua internet.")}
            onClick={toggle}
            crossOrigin="anonymous"
          >
            {src.subtitles && subs && <track kind="subtitles" src={src.subtitles} srcLang="pt" label="Português" default />}
          </video>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.poster && <img src={p.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
            <button type="button" onClick={start} className="absolute inset-0 flex items-center justify-center" aria-label="Reproduzir">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-[#1A0E05] shadow-xl">
                {loading ? <span className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A0E05]/30 border-t-[#1A0E05]" /> : <IconPlay size={36} />}
              </span>
            </button>
          </>
        )}

        {showHook && p.next && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 p-4 text-center">
            <p className="font-display text-xl font-extrabold text-accent2 sm:text-3xl">Queres saber o que acontece?</p>
            {p.hookText && <p className="line-clamp-3 max-w-md text-sm text-fg/90 sm:text-base">{p.hookText}</p>}
          </div>
        )}

        {showAdUpsell && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/90 p-4 text-center">
            <p className="font-display text-2xl font-extrabold text-accent2 sm:text-3xl">Gostaste?</p>
            <p className="text-fg/90">Continua já por {p.priceCoins} moedas.</p>
          </div>
        )}

        {ended && p.next && (p.next.state === "free" || p.next.state === "unlocked") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <Link href={`/ver/${p.next.id}`} className="btn-primary text-lg"><IconNext size={20} /> Episódio {p.next.number}</Link>
          </div>
        )}
      </div>

      {(showHook || showAdUpsell) && p.next && (
        <div className="card mt-3 flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-semibold">Episódio {p.next.number}</p>
          {p.next.state === "pending" ? (
            <p className="badge-pending text-sm"><IconClock size={14} /> O teu pagamento do episódio {p.next.number} está a ser confirmado</p>
          ) : (
            <UnlockPanel episodeId={p.next.id} priceCoins={p.priceCoins} balance={p.balance} points={p.points} pointsCost={p.pointsCost} loggedIn={p.loggedIn} adOffer={showHook ? p.adOffer : false} />
          )}
        </div>
      )}
      {showAdUpsell && (
        <div className="mt-2 flex justify-center">
          <Link href={`/loja?voltar=${encodeURIComponent(`/ver/${p.episodeId}`)}`} className="btn-secondary no-underline">Ir à Loja</Link>
        </div>
      )}

      {error && <p role="alert" className="mt-2 rounded-xl bg-danger/15 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Barra de progresso */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={time}
          onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
          className="w-full accent-accent"
          aria-label="Progresso do vídeo"
          disabled={!src}
          style={{ background: `linear-gradient(to right, rgb(var(--c-accent)) ${progress}%, transparent ${progress}%)` }}
        />
        <div className="flex justify-between text-xs text-muted"><span>{fmt(time)}</span><span>{fmt(duration)}</span></div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} className="btn-primary min-w-[120px]" aria-label={playing ? "Pausa" : "Reproduzir"}>
          {playing ? <><IconPause size={20} /> Pausa</> : <><IconPlay size={20} /> Play</>}
        </button>
        {p.next && (p.next.state === "free" || p.next.state === "unlocked") && (
          <Link href={`/ver/${p.next.id}`} className="btn-secondary btn-sm"><IconNext size={18} /> Próximo</Link>
        )}
        {p.hasSubtitles && (
          <button type="button" onClick={() => setSubs(!subs)} className={subs ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} aria-pressed={subs}>
            <IconSubtitles size={18} /> Legendas
          </button>
        )}
        <button type="button" onClick={toggleDataSaver} className={dataSaver ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} aria-pressed={dataSaver}>
          <IconGauge size={18} /> {dataSaver ? "Poupar dados" : "480p"}
        </button>
        <button type="button" onClick={() => videoRef.current?.requestFullscreen?.()} className="btn-ghost btn-sm" aria-label="Ecrã inteiro" disabled={!src}>
          <IconExpand size={18} />
        </button>
        <button type="button" onClick={() => setShowGifts(!showGifts)} className="btn-secondary btn-sm" aria-expanded={showGifts}>
          <IconGift size={18} /> Presentes
        </button>
      </div>
      {showGifts && (
        <div className="card mt-3">
          <p className="text-sm text-muted">Apoia {p.artist.name} com um presente pago com moedas. {p.artist.name} ganha 50% do valor.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {p.gifts.map((g) => (
              <button
                key={g.code}
                type="button"
                disabled={giftPending}
                onClick={() => sendGift(g.code)}
                className="flex min-h-[72px] flex-col items-center justify-center rounded-xl bg-surface2 p-2 text-center hover:ring-2 hover:ring-accent disabled:opacity-50"
              >
                <span className="text-2xl" aria-hidden>{g.emoji}</span>
                <span className="font-semibold text-fg">{g.label}</span>
                <span className="text-sm text-accent">{g.priceCoins} moedas</span>
              </button>
            ))}
          </div>
          {giftMsg && (
            <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${giftMsg.ok ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>
              {giftMsg.text} {!giftMsg.ok && giftMsg.buy && <Link href={`/loja?voltar=${encodeURIComponent(`/ver/${p.episodeId}`)}`} className="font-semibold underline">Comprar moedas</Link>}
            </p>
          )}
        </div>
      )}
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-2xl bg-accent2 px-4 py-3 font-semibold text-[#1A0E05] shadow-xl md:bottom-8">
          <IconStar size={18} /> {toast}
        </div>
      )}
      {!p.loggedIn && <p className="mt-3 text-sm text-muted"><Link href="/registar" className="text-accent2 underline">Cria conta grátis</Link> para guardar o teu progresso.</p>}
    </div>
  );
}
