"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EpisodeState } from "@/domain/access";
import { UnlockSheet, type SheetPack, type SheetSeason, type SheetWelcome } from "@/components/UnlockSheet";
import {
  IconBookmark, IconCheck, IconChevronLeft, IconClock, IconCoin, IconGauge, IconGift, IconLock, IconPlay, IconStar, IconSubtitles, IconX,
} from "@/components/icons";
import { toggleFavoriteAction } from "@/app/lista/actions";
import { sendGiftAction } from "./actions";

export type ReelEpisode = { id: string; number: number; title: string; state: EpisodeState; endsWithHook: boolean; hookText: string | null };

type Props = {
  series: { id: string; slug: string; title: string; freeEpisodes: number; coverUrl: string | null };
  artist: { id: string; slug: string; name: string };
  episodes: ReelEpisode[];
  initialIndex: number;
  priceCoins: number;
  season: SheetSeason;
  packs: SheetPack[];
  welcome: SheetWelcome;
  payLines: { label: string; value: string }[];
  payerPhone: string;
  pendingPayment: boolean;
  /** Link para partilhar (com o código de convite de quem partilha). */
  shareUrl: string;
  /** Nome curto de quem está a ver (para a animação do presente). */
  viewerName: string | null;
  /** Série retirada: aviso no topo e sem desbloqueios. */
  withdrawnNotice?: string | null;
  balance: number;
  points: number;
  pointsCost: number;
  adOffer: boolean;
  adUnlockedIds: string[];
  isFavorite: boolean;
  loggedIn: boolean;
  gifts: { code: string; label: string; emoji: string; priceCoins: number }[];
};

type Src = { url: string; subtitles: string | null; quality: "low" | "medium" };
const canWatch = (s: EpisodeState) => s === "free" || s === "unlocked";

/**
 * LEITOR ESTILO REELS: vídeo vertical em ecrã inteiro.
 * Deslizar para cima = episódio seguinte; para baixo = anterior. Toque = pausa/continua.
 * Só carrega o episódio atual e prepara o seguinte (leve para dados móveis).
 */
export function ReelPlayer(p: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(p.initialIndex);
  const [states, setStates] = useState<Record<string, EpisodeState>>(() => Object.fromEntries(p.episodes.map((e) => [e.id, e.state])));
  const [balance, setBalance] = useState(p.balance);
  const [points, setPoints] = useState(p.points);
  const [adOffer, setAdOffer] = useState(p.adOffer);
  const [adUnlocked, setAdUnlocked] = useState<Set<string>>(() => new Set(p.adUnlockedIds));
  const [fav, setFav] = useState(p.isFavorite);
  const [srcs, setSrcs] = useState<Record<string, Src>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [portrait, setPortrait] = useState(true);
  const [dataSaver, setDataSaver] = useState(true);
  const [subs, setSubs] = useState(true);
  const [sheet, setSheet] = useState<null | "episodes" | "gifts">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [arrivedFromAd, setArrivedFromAd] = useState(false);
  const [finished, setFinished] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [lockClosed, setLockClosed] = useState(false);
  const [season, setSeason] = useState(p.season);
  const [giftFx, setGiftFx] = useState<{ id: string; text: string; emoji: string } | null>(null);
  const seenGifts = useRef<Set<string>>(new Set());
  const giftQueue = useRef<{ id: string; text: string; emoji: string }[]>([]);
  const trackRef = useRef<HTMLTrackElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const touch = useRef<{ y: number; t: number } | null>(null);
  const wheelLock = useRef(0);
  const watched = useRef(0);
  const lastTick = useRef<number | null>(null);
  const lastSent = useRef(0);

  const ep = p.episodes[index];
  const state = states[ep.id];
  const next = p.episodes[index + 1] ?? null;
  const prev = p.episodes[index - 1] ?? null;
  const src = srcs[ep.id];

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    try {
      if (localStorage.getItem("dataSaver") === "0") setDataSaver(false);
      if (localStorage.getItem("subs") === "0") setSubs(false);
    } catch {}
  }, []);

  // ---------- links dos vídeos (só o atual + preparar o seguinte) ----------
  const loadSrc = useCallback(
    async (id: string, quality: "low" | "medium") => {
      const r = await fetch(`/api/play/${id}?q=${quality}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error ?? "Não foi possível carregar o vídeo.");
      setSrcs((s) => ({ ...s, [id]: { url: d.url, subtitles: d.subtitles ?? null, quality } }));
    },
    [],
  );

  useEffect(() => {
    setLoadError(null);
    const q = dataSaver ? "low" : "medium";
    if (canWatch(state) && (!src || src.quality !== q)) loadSrc(ep.id, q).catch((e) => setLoadError(e.message));
    if (next && canWatch(states[next.id]) && !srcs[next.id]) loadSrc(next.id, q).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ep.id, state, dataSaver]);

  // URL da página acompanha o episódio (para partilhar / voltar)
  useEffect(() => {
    window.history.replaceState(null, "", `/ver/${ep.id}`);
    setTime(0);
    setDuration(0);
    setFinished(false);
    watched.current = 0;
    lastTick.current = null;
  }, [ep.id]);

  // ---------- progresso (minutos vistos, pontos de fã) ----------
  const sendProgress = useCallback(
    (episodeId: string, completed = false) => {
      if (!p.loggedIn) return;
      const seconds = Math.round(watched.current);
      if (seconds <= 0 && !completed) return;
      watched.current = 0;
      const body = JSON.stringify({ seconds, position: Math.round(videoRef.current?.currentTime ?? 0), completed });
      fetch(`/api/progress/${episodeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
        .then((r) => r.json())
        .then((d) => d?.points > 0 && flash(`+${d.points} pontos de fã`))
        .catch(() => {});
    },
    [p.loggedIn],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && sendProgress(ep.id);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [ep.id, sendProgress]);

  // Legendas desenhadas pela app (acima do nome da série), em vez das do navegador
  useEffect(() => {
    setCaption(null);
    const el = trackRef.current;
    if (!el) return;
    const t = el.track;
    t.mode = "hidden";
    const onCue = () => {
      const cues = Array.from(t.activeCues ?? []) as VTTCue[];
      setCaption(cues.length ? cues.map((c) => c.text).join("\n") : null);
    };
    t.addEventListener("cuechange", onCue);
    return () => t.removeEventListener("cuechange", onCue);
  }, [src?.subtitles, subs, ep.id]);

  // ---------- navegação ----------
  const go = useCallback(
    (to: number, opts: { fromEnd?: boolean } = {}) => {
      if (to < 0 || to >= p.episodes.length || to === index) return;
      sendProgress(ep.id);
      setArrivedFromAd(!!opts.fromEnd && adUnlocked.has(ep.id));
      setSheet(null);
      setIndex(to);
      setLockClosed(false);
    },
    [index, p.episodes.length, ep.id, adUnlocked, sendProgress],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (e.key === "ArrowDown") go(index + 1);
      if (e.key === "ArrowUp") go(index - 1);
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest("[data-noswipe]")) return;
    touch.current = { y: e.touches[0].clientY, t: Date.now() };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const t = touch.current;
    touch.current = null;
    if (!t || sheet) return;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dy) > 60 && Date.now() - t.t < 800) go(dy < 0 ? index + 1 : index - 1);
  }
  function onWheel(e: React.WheelEvent) {
    if (sheet || (e.target as HTMLElement).closest("[data-noswipe]")) return;
    const now = Date.now();
    if (now - wheelLock.current < 700 || Math.abs(e.deltaY) < 30) return;
    wheelLock.current = now;
    go(e.deltaY > 0 ? index + 1 : index - 1);
  }

  // ---------- reprodução ----------
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true));
    else v.pause();
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    v.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true)); // começa sozinho (se o navegador deixar)
  }, [src?.url]);

  function onTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    setTime(v.currentTime);
    const now = performance.now();
    if (lastTick.current !== null && !v.paused) {
      const d = (now - lastTick.current) / 1000;
      if (d > 0 && d < 5) watched.current += d * v.playbackRate;
    }
    lastTick.current = now;
    if (now - lastSent.current > 15000) {
      lastSent.current = now;
      sendProgress(ep.id);
    }
  }

  function onEnded() {
    sendProgress(ep.id, true);
    setPlaying(false);
    if (next) go(index + 1, { fromEnd: true });
    else setFinished(true);
  }

  // ---------- desbloqueio ----------
  function unlocked(id: string, via: "coins" | "points" | "ad") {
    setStates((s) => ({ ...s, [id]: "unlocked" }));
    if (via === "coins") setBalance((b) => Math.max(0, b - p.priceCoins));
    if (via === "points") setPoints((x) => Math.max(0, x - p.pointsCost));
    if (via === "ad") {
      setAdOffer(false);
      setAdUnlocked((s) => new Set(s).add(id));
    }
    setArrivedFromAd(false);
  }
  function seasonUnlocked(ids: string[], coins: number) {
    setStates((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, "unlocked" as EpisodeState])) }));
    setBalance((b) => Math.max(0, b - coins));
    setSeason(null);
    flash(`${ids.length} episódios desbloqueados!`);
  }

  // ---------- botões da direita ----------
  async function toggleFav() {
    const r = await toggleFavoriteAction(p.series.id);
    if (r.login) router.push(`/entrar?next=${encodeURIComponent(`/ver/${ep.id}`)}`);
    else if (r.ok) {
      setFav(!!r.saved);
      flash(r.saved ? "Guardada na tua lista" : "Retirada da tua lista");
    }
  }
  // ---------- animação dos presentes ("Paulo enviou uma 👑 Coroa!") ----------
  const showGift = useCallback((g: { id: string; text: string; emoji: string }) => {
    if (seenGifts.current.has(g.id)) return;
    seenGifts.current.add(g.id);
    giftQueue.current.push(g);
    setGiftFx((cur) => cur ?? giftQueue.current.shift() ?? null);
  }, []);
  useEffect(() => {
    if (!giftFx) return;
    const t = setTimeout(() => setGiftFx(giftQueue.current.shift() ?? null), 3200);
    return () => clearTimeout(t);
  }, [giftFx]);
  useEffect(() => {
    let since = Date.now() - 60_000;
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/presentes/recentes?artista=${p.artist.id}&desde=${since}`, { cache: "no-store" }).then((x) => x.json());
        if (stop) return;
        since = r.now ?? Date.now();
        for (const g of r.gifts ?? []) showGift({ id: g.id, text: `${g.name} enviou ${g.label === "Coroa" ? "uma" : "um"} ${g.emoji} ${g.label}!`, emoji: g.emoji });
      } catch {}
    };
    tick();
    const t = setInterval(tick, 20_000);
    return () => { stop = true; clearInterval(t); };
  }, [p.artist.id, showGift]);

  async function share() {
    const url = p.shareUrl;
    try {
      if (navigator.share) await navigator.share({ title: p.series.title, text: `Mano, vê esta série, está a bater! 🔥 Os ${p.series.freeEpisodes} primeiros episódios são grátis 👉`, url });
      else {
        await navigator.clipboard.writeText(url);
        flash("Link copiado");
      }
    } catch {}
  }
  function toggleSaver() {
    const v = !dataSaver;
    setDataSaver(v);
    try { localStorage.setItem("dataSaver", v ? "1" : "0"); } catch {}
    flash(v ? "Poupar dados: 360p" : "Qualidade: 480p");
  }
  function toggleSubs() {
    const v = !subs;
    setSubs(v);
    try { localStorage.setItem("subs", v ? "1" : "0"); } catch {}
    flash(v ? "Legendas ligadas" : "Legendas desligadas");
  }
  async function sendGift(code: string) {
    if (!p.loggedIn) return router.push(`/entrar?next=${encodeURIComponent(`/ver/${ep.id}`)}`);
    const g = p.gifts.find((x) => x.code === code);
    if (!g) return;
    if (balance < g.priceCoins) return flash(`Precisas de ${g.priceCoins} moedas`);
    const r = await sendGiftAction(p.artist.id, code);
    if (r.ok) {
      setBalance((b) => b - g.priceCoins);
      setSheet(null);
      showGift({ id: (r.ok && r.id) || `me-${Date.now()}`, text: `${p.viewerName ?? "Tu"} enviou ${g.label === "Coroa" ? "uma" : "um"} ${g.emoji} ${g.label}!`, emoji: g.emoji });
    } else flash(r.error);
  }

  // texto por cima do cartão de desbloqueio
  const prevEp = prev;
  const hook = prevEp && (prevEp.endsWithHook || prevEp.number === p.series.freeEpisodes) ? prevEp.hookText : null;
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center bg-black text-fg"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      <div className="relative h-[100dvh] w-full overflow-hidden md:w-[min(100vw,calc(100dvh*9/16))]">
        {/* Fundo: capa desfocada (para vídeos que não são verticais e para episódios bloqueados) */}
        {p.series.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.series.coverUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
        )}

        {/* Vídeo atual */}
        {canWatch(state) && src && (
          <video
            key={ep.id}
            ref={videoRef}
            src={src.url}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            className={`absolute inset-0 h-full w-full ${portrait ? "object-cover" : "object-contain"}`}
            onClick={togglePlay}
            onPlay={() => { setPlaying(true); lastTick.current = performance.now(); }}
            onPause={() => { setPlaying(false); lastTick.current = null; sendProgress(ep.id); }}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuration(v.duration);
              setPortrait(v.videoHeight >= v.videoWidth);
            }}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            onError={() => setLoadError("Não foi possível reproduzir. Verifica a tua internet.")}
          >
            {src.subtitles && subs && (
              <track
                ref={trackRef}
                kind="subtitles"
                src={src.subtitles}
                srcLang="pt"
                label="Português"
                default
              />
            )}
          </video>
        )}
        {/* Preparar o seguinte: só os metadados (poucos KB) */}
        {next && srcs[next.id] && <video key={`pre-${next.id}`} src={srcs[next.id].url} preload="metadata" muted className="hidden" aria-hidden />}

        {/* A carregar / play manual */}
        {canWatch(state) && !src && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center"><span className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-accent" /></div>
        )}
        {canWatch(state) && src && (needTap || (!playing && time > 0 && !finished)) && (
          <button type="button" onClick={togglePlay} className="absolute inset-0 flex items-center justify-center" aria-label="Continuar">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-black/50 text-white"><IconPlay size={40} /></span>
          </button>
        )}
        {loadError && <p role="alert" className="absolute inset-x-4 top-1/3 rounded-xl bg-danger/20 px-4 py-3 text-center text-sm text-danger">{loadError}</p>}
        {p.withdrawnNotice && <p role="note" className="pointer-events-none absolute inset-x-4 top-16 z-10 rounded-xl bg-warn/20 px-3 py-2 text-center text-xs text-warn">{p.withdrawnNotice}</p>}

        {/* Episódio bloqueado: painel de desbloqueio por cima do vídeo desfocado */}
        {!canWatch(state) && (state === "pending" || p.withdrawnNotice) && (
          <div className="absolute inset-x-4 bottom-24 z-20 rounded-2xl bg-surface/95 p-4 text-center text-sm" data-noswipe>
            {state === "pending"
              ? <p className="badge-pending"><IconClock size={14} /> Pagamento a aguardar confirmação</p>
              : <p className="text-muted">Esta série foi retirada. Já não é possível desbloquear episódios.</p>}
          </div>
        )}
        {!canWatch(state) && state !== "pending" && !p.withdrawnNotice && (lockClosed ? (
          <button type="button" onClick={() => setLockClosed(false)} className="btn-primary absolute inset-x-6 bottom-24 z-20 text-lg" data-noswipe>
            <IconLock size={20} /> Desbloquear episódio {ep.number}
          </button>
        ) : (
          <UnlockSheet
            key={ep.id}
            episodeId={ep.id}
            episodeNumber={ep.number}
            seriesId={p.series.id}
            priceCoins={p.priceCoins}
            balance={balance}
            points={points}
            pointsCost={p.pointsCost}
            loggedIn={p.loggedIn}
            adOffer={adOffer}
            season={season}
            packs={p.packs}
            welcome={p.welcome}
            payLines={p.payLines}
            payerPhone={p.payerPhone}
            hook={hook}
            shareHook={prev && prev.number === p.series.freeEpisodes ? { url: p.shareUrl, title: p.series.title } : null}
            arrivedFromAd={arrivedFromAd}
            pendingPayment={p.pendingPayment}
            onUnlocked={(via) => unlocked(ep.id, via)}
            onSeasonUnlocked={seasonUnlocked}
            onBalance={setBalance}
            onClose={() => setLockClosed(true)}
            onEpisodes={() => setSheet("episodes")}
          />
        ))}

        {finished && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center" data-noswipe>
            <p className="font-display text-2xl font-extrabold">Fim de “{p.series.title}”</p>
            <p className="text-sm text-muted">Gostaste? Oferece um presente a {p.artist.name} ou descobre mais séries.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSheet("gifts")} className="btn-secondary"><IconGift size={18} /> Presente</button>
              <Link href="/" className="btn-primary no-underline">Mais séries</Link>
            </div>
          </div>
        )}

        {/* Topo: voltar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(12px,env(safe-area-inset-top))]" data-noswipe>
          <Link href={`/serie/${p.series.slug}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white" aria-label="Voltar à série">
            <IconChevronLeft size={24} />
          </Link>
          <Link href={`/loja?voltar=${encodeURIComponent(`/ver/${ep.id}`)}`} className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-2 text-sm font-semibold text-accent2 no-underline">
            <IconCoin size={18} /> {p.loggedIn ? balance : "Loja"}
          </Link>
        </div>

        {/* Botões da direita (escondidos quando o episódio está bloqueado, para não tapar o cartão) */}
        {canWatch(state) && (
        <div className="absolute bottom-28 right-2 flex flex-col items-center gap-3" data-noswipe>
          <RailButton label="Presentes" onClick={() => setSheet("gifts")}><IconGift size={24} /></RailButton>
          <RailButton label={fav ? "Na lista" : "Guardar"} onClick={toggleFav} active={fav}>{fav ? <IconCheck size={24} /> : <IconBookmark size={24} />}</RailButton>
          <RailButton label="Episódios" onClick={() => setSheet("episodes")}><span className="font-display text-lg font-bold">{ep.number}/{p.episodes.length}</span></RailButton>
          <RailButton label="Partilhar" onClick={share}><ShareIcon /></RailButton>
          {src?.subtitles && <RailButton label="Legendas" onClick={toggleSubs} active={subs}><IconSubtitles size={24} /></RailButton>}
          <RailButton label={dataSaver ? "360p" : "480p"} onClick={toggleSaver} active={dataSaver}><IconGauge size={24} /></RailButton>
        </div>
        )}

        {caption && subs && (
          <p className="pointer-events-none absolute bottom-40 left-4 right-20 z-[1] whitespace-pre-line text-center text-base font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">
            <span className="rounded-lg bg-black/55 px-2 py-1 [box-decoration-break:clone]">{caption}</span>
          </p>
        )}

        {/* Em baixo: série, episódio, artista e progresso */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 pb-[max(16px,env(safe-area-inset-bottom))] pr-20" data-noswipe>
          <Link href={`/serie/${p.series.slug}`} className="block truncate font-display text-lg font-extrabold text-white no-underline">{p.series.title}</Link>
          <p className="text-sm text-white/85">Episódio {ep.number} de {p.episodes.length}{ep.title ? ` · ${ep.title}` : ""}</p>
          <Link href={`/${p.artist.slug}`} className="text-sm text-accent2 no-underline">@{p.artist.name}</Link>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Folhas de baixo */}
        {sheet && (
          <div className="absolute inset-0 z-10 flex items-end bg-black/60" onClick={() => setSheet(null)} data-noswipe>
            <div className="max-h-[75%] w-full overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(16px,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-lg font-bold">{sheet === "episodes" ? `${p.series.title} · ${p.episodes.length} episódios` : `Presente para ${p.artist.name}`}</p>
                <button type="button" onClick={() => setSheet(null)} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface2" aria-label="Fechar"><IconX size={20} /></button>
              </div>
              {sheet === "episodes" ? (
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {p.episodes.map((e, i) => {
                    const st = states[e.id];
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => go(i)}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold ${i === index ? "bg-accent text-[#1A0E05]" : "bg-surface2 text-fg"}`}
                        aria-label={`Episódio ${e.number}${canWatch(st) ? "" : `, bloqueado, ${p.priceCoins} moedas`}`}
                      >
                        {e.number}
                        {st === "free" && <span className="text-[9px] font-semibold text-ok">grátis</span>}
                        {st === "locked" && <span className="flex items-center gap-0.5 text-[9px] font-semibold text-accent2"><IconLock size={9} />{p.priceCoins}</span>}
                        {st === "pending" && <span className="text-[9px] text-warn">pendente</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted">Pago com moedas. {p.artist.name} ganha 50% do valor. Tens {balance} moedas.</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {p.gifts.map((g) => (
                      <button key={g.code} type="button" onClick={() => sendGift(g.code)} className="flex min-h-[80px] flex-col items-center justify-center rounded-xl bg-surface2 p-2 hover:ring-2 hover:ring-accent">
                        <span className="text-2xl" aria-hidden>{g.emoji}</span>
                        <span className="font-semibold">{g.label}</span>
                        <span className="text-sm text-accent">{g.priceCoins} moedas</span>
                      </button>
                    ))}
                  </div>
                  {balance < Math.min(...p.gifts.map((g) => g.priceCoins), Infinity) && (
                    <Link href={`/loja?voltar=${encodeURIComponent(`/ver/${ep.id}`)}`} className="btn-primary mt-3 w-full no-underline"><IconCoin size={18} /> Comprar moedas</Link>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {giftFx && (
          <div key={giftFx.id} role="status" className="pointer-events-none absolute inset-x-0 top-1/4 z-30 flex flex-col items-center animate-[giftpop_3.2s_ease-out_forwards]">
            <span className="text-7xl drop-shadow-2xl">{giftFx.emoji}</span>
            <span className="mt-2 rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-accent2">{giftFx.text}</span>
          </div>
        )}
        {toast && (
          <div role="status" className="absolute inset-x-6 top-20 z-20 mx-auto flex max-w-xs items-center justify-center gap-2 rounded-2xl bg-accent2 px-4 py-3 text-center font-semibold text-[#1A0E05] shadow-xl">
            <IconStar size={18} /> {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function RailButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className="flex min-w-[56px] flex-col items-center gap-1 text-[11px] font-semibold text-white drop-shadow">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? "bg-accent/90 text-[#1A0E05]" : "bg-black/45"}`}>{children}</span>
      {label}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 5l6 6-6 6" />
      <path d="M20 11H10a6 6 0 0 0-6 6v2" />
    </svg>
  );
}
