"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconPlay, IconX } from "./icons";

type Suggestion = { slug: string; title: string; synopsis: string; freeEpisodes: number; coverUrl: string | null; firstEpisodeId: string | null };

/** Páginas onde a sugestão NÃO aparece (trabalho, pagamentos, a ver um episódio…). */
const HIDDEN = ["/admin", "/artista", "/pagar", "/entrar", "/registar", "/legal", "/extrato", "/ver/", "/offline"];
const KEY = "sugestao-dia";

/** Cartão grande com uma série sugerida, no máximo 1 vez por dia por pessoa. */
export function SuggestionCard() {
  const pathname = usePathname();
  const [s, setS] = useState<Suggestion | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tried = useRef(false);

  useEffect(() => {
    // Tenta uma vez por abertura da app, na primeira página "normal" (ex.: depois de entrar na conta)
    if (tried.current || HIDDEN.some((p) => pathname.startsWith(p))) return;
    tried.current = true;
    let seen: string | null = null;
    try { seen = localStorage.getItem(KEY); } catch {}
    const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
    if (seen === today) return;
    let cancelled = false;
    fetch("/api/sugestao", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        try { localStorage.setItem(KEY, d.today ?? today); } catch {}
        if (d.series?.firstEpisodeId) {
          setS(d.series);
          fetch("/api/sugestao", { method: "POST" }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    if (!s) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setS(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  if (!s) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sugestao-titulo" className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center" onClick={() => setS(null)}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" onClick={() => setS(null)} aria-label="Fechar" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-fg">
          <IconX size={20} />
        </button>
        <div className="relative aspect-[4/3] bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.coverUrl && <img src={s.coverUrl} alt="" className="h-full w-full object-cover object-top" />}
          <span className="badge-free absolute bottom-3 left-4 bg-black/75">{s.freeEpisodes} {s.freeEpisodes === 1 ? "episódio grátis" : "episódios grátis"}</span>
        </div>
        <div className="p-5 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent2">Sugestão para ti</p>
          <h2 id="sugestao-titulo" className="mt-1 text-2xl font-extrabold">{s.title}</h2>
          {s.synopsis && <p className="mt-2 line-clamp-2 text-sm text-fg/85">{s.synopsis}</p>}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <Link href={`/ver/${s.firstEpisodeId}`} onClick={() => setS(null)} className="btn-primary flex-1 no-underline">
            <IconPlay size={20} /> Começar a ver
          </Link>
          <button type="button" onClick={() => setS(null)} className="btn-ghost">Agora não</button>
        </div>
      </div>
    </div>
  );
}
