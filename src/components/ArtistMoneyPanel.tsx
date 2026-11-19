"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MoneyDisplay } from "@/domain/artists/growth";
import { IconClock, IconTrophy, IconWallet } from "./icons";

const fmt = (cents: number) => new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(Math.floor(cents / 100)) + " Kz";

/** Número que "conta" suavemente até ao novo valor (só blocos). */
function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1200);
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

/** Barra de progresso SEM números. */
function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** Mini gráfico dos últimos 7 dias — só alturas relativas, sem valores. */
function Spark({ heights }: { heights: number[] }) {
  return (
    <div className="flex h-12 shrink-0 items-end gap-1" aria-label="Atividade dos últimos 7 dias" role="img">
      {heights.map((h, i) => (
        <span key={i} className={`w-2.5 rounded-t-[3px] ${i === heights.length - 1 ? "bg-accent2" : "bg-accent2/50"}`} style={{ height: h > 0 ? `${Math.max(12, h * 100)}%` : "3px" }} />
      ))}
    </div>
  );
}

type Celebration = { id: string; title: string; prizeCents: number; hasPrize: boolean; withdraw?: boolean };

/**
 * PAINEL FINANCEIRO DO ARTISTA — os valores aparecem só em BLOCOS (ex.: 5.000 Kz, arredondado para
 * baixo). Antes de completar um bloco mostra-se só uma barra, sem números. Os valores exatos estão
 * no extrato da Carteira. Atualiza-se sozinho de 15 em 15 s.
 */
export function ArtistMoneyPanel({ initial, spark = [] }: { initial: MoneyDisplay; spark?: number[] }) {
  const [d, setD] = useState(initial);
  const [pulse, setPulse] = useState(false);
  const [celebrate, setCelebrate] = useState<Celebration[]>(initial.achievements);
  const shownIds = useRef(new Set(initial.achievements.map((a) => a.id)));
  const lastProgress = useRef(initial.total.blocks + initial.total.progress);
  const lastAvailBlocks = useRef(initial.available.blocks);
  const total = useCountUp(d.total.shownCents);
  const available = useCountUp(d.available.shownCents);
  const block = fmt(d.blockCents);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/artista/carteira", { cache: "no-store" });
        if (!r.ok) return;
        const { display } = (await r.json()) as { display: MoneyDisplay };
        const prog = display.total.blocks + display.total.progress;
        if (prog > lastProgress.current) { setPulse(true); setTimeout(() => setPulse(false), 3000); }
        lastProgress.current = prog;
        const fresh: Celebration[] = display.achievements.filter((a) => !shownIds.current.has(a.id));
        fresh.forEach((a) => shownIds.current.add(a.id));
        // Um bloco ficou completo e disponível
        if (display.available.blocks > lastAvailBlocks.current) {
          const gained = (display.available.blocks - lastAvailBlocks.current) * display.blockCents;
          fresh.push({ id: `avail-${display.available.blocks}`, title: `🎉 Ganhaste ${fmt(gained)}! Já podes levantar.`, prizeCents: 0, hasPrize: false, withdraw: true });
        }
        lastAvailBlocks.current = display.available.blocks;
        if (fresh.length) setCelebrate((c) => [...c, ...fresh]);
        setD(display);
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const closeCelebration = useCallback(() => {
    setCelebrate((c) => {
      const rest = c.slice(1);
      if (rest.length === 0) fetch("/api/artista/carteira", { method: "POST" }).catch(() => {});
      return rest;
    });
  }, []);

  const r = d.nextReward;
  const firstBlock = d.total.blocks === 0;

  return (
    <section className="mt-4 space-y-3">
      {/* Os teus ganhos na KONTA (cartão dourado) */}
      <div className={`relative overflow-hidden rounded-3xl border border-accent2/40 bg-gradient-to-br from-accent2/35 via-accent/15 to-surface p-5 shadow-[0_10px_40px_-15px_rgb(var(--c-accent2)/0.6)] transition ${pulse ? "ring-2 ring-ok/60" : ""}`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-accent2"><IconWallet size={18} /> Os teus ganhos na KONTA</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            {firstBlock ? (
              <p className="font-display text-xl font-extrabold leading-snug text-fg">O teu primeiro bloco de {block} está quase pronto 🔥</p>
            ) : (
              <>
                <p className="font-display text-4xl font-extrabold text-fg sm:text-5xl" aria-live="polite">{fmt(total)}</p>
                <p className="mt-0.5 text-sm text-muted">O teu próximo bloco de {block} está a caminho 🔥</p>
              </>
            )}
            <Bar pct={d.total.progress * 100} label={firstBlock ? "Progresso do primeiro bloco" : "Progresso do próximo bloco"} />
            <p className={`mt-1.5 text-xs ${d.activeToday ? "font-semibold text-ok" : "text-muted"}`}>{d.activeToday ? "▲ Os teus ganhos cresceram hoje" : "Hoje ainda sem desbloqueios"}</p>
          </div>
          {spark.length > 0 && <Spark heights={spark} />}
        </div>
        {pulse && <span className="absolute right-4 top-4 animate-[giftpop_3s_ease-out_forwards] rounded-full bg-ok px-3 py-1 text-xs font-bold text-[#06210F]">▲ A crescer</span>}
      </div>

      {/* Pendente · Disponível · Levantado */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-warn/30 bg-warn/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warn"><IconClock size={14} /> Pendente</p>
          {d.pending.shownCents > 0 ? <p className="mt-1 font-display text-2xl font-bold">{fmt(d.pending.shownCents)}</p> : null}
          <p className="mt-1 text-xs text-muted">
            {d.pending.hasSome
              ? d.pending.daysLeft === 0 ? "Os teus ganhos mais recentes ficam disponíveis hoje." : `Os teus ganhos mais recentes ficam disponíveis em ${d.pending.daysLeft} ${d.pending.daysLeft === 1 ? "dia" : "dias"}.`
              : "Cada ganho novo fica aqui uns dias e depois passa sozinho a Disponível."}
          </p>
        </div>
        <div className="rounded-2xl border border-ok/40 bg-ok/10 p-4">
          <p className="text-xs font-semibold text-ok">Disponível</p>
          {d.available.blocks > 0 ? (
            <p className="mt-1 font-display text-2xl font-bold text-ok">{fmt(available)}</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-fg">O teu primeiro bloco de {block} está quase pronto 🔥</p>
              <Bar pct={d.available.progress * 100} label="Progresso do bloco disponível" />
            </>
          )}
          {d.canWithdraw ? (
            <Link href="/artista/carteira#levantar" className="btn-primary btn-sm mt-2 w-full no-underline">Levantar</Link>
          ) : (
            <p className="mt-1.5 text-xs text-muted">Podes levantar a partir de {fmt(d.minPayoutCents)}.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <p className="text-xs font-semibold text-muted">Levantado</p>
          <p className="mt-1 font-display text-2xl font-bold">{fmt(d.withdrawnCents)}</p>
          <p className="mt-1 text-xs text-muted">{d.processingCents > 0 ? `${fmt(d.processingCents)} a caminho da tua conta.` : "Já transferido para a tua conta."}</p>
        </div>
      </div>
      <p className="text-xs text-muted">🔒 Cada movimento fica registado. Os valores exatos estão na <Link href="/artista/carteira" className="underline">Carteira</Link> e no extrato mensal.</p>

      {/* Próxima conquista (bónus real) */}
      {r && (
        <div className="card">
          <p className="flex items-center gap-2 text-sm font-semibold"><IconTrophy size={18} className="text-accent2" /> Próxima conquista</p>
          <p className="mt-1 text-sm">
            <strong>{r.target.toLocaleString("pt-AO")} desbloqueios</strong> em “{r.seriesTitle}” — já tens {r.unlocks.toLocaleString("pt-AO")}
            {r.hasBonus ? <> · ganhas um bónus{r.bonusCents > 0 ? <> de <strong className="text-accent">{fmt(r.bonusCents)}</strong></> : null}</> : null}{r.crown ? " e a coroa 👑" : ""} 🔥
          </p>
          <Bar pct={(r.unlocks / r.target) * 100} label="Progresso para a próxima conquista" />
        </div>
      )}

      {/* Próxima meta: o próximo bloco */}
      {d.goal && (
        <div className="card">
          <p className="text-sm font-semibold">Próxima meta: {fmt(d.goal.targetCents)} 🔥</p>
          <Bar pct={d.goal.progress * 100} label="Progresso para a próxima meta" />
          <p className="mt-1 text-xs text-muted">{d.goalsReached > 0 ? `${d.goalsReached} ${d.goalsReached === 1 ? "meta atingida" : "metas atingidas"} até agora. ` : ""}As metas nunca impedem levantamentos.</p>
        </div>
      )}

      {/* Animação de conquista (só conquistas reais e novas) */}
      {celebrate.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6" role="dialog" aria-label="Conquista">
          <div className="w-full max-w-sm animate-[giftpop_0.6s_ease-out_both] rounded-3xl bg-surface p-6 text-center shadow-2xl" style={{ animationFillMode: "both" }}>
            <p className="text-6xl" aria-hidden>🏆</p>
            <p className="mt-2 font-display text-2xl font-extrabold text-accent2">Parabéns!</p>
            <p className="mt-1 text-fg">{celebrate[0].title}</p>
            {celebrate[0].hasPrize && <p className="mt-2 rounded-xl bg-ok/15 px-3 py-2 font-semibold text-ok">Recebeste um bónus{celebrate[0].prizeCents > 0 ? ` de ${fmt(celebrate[0].prizeCents)}` : ""} na tua carteira.</p>}
            {celebrate[0].withdraw ? (
              <Link href="/artista/carteira#levantar" onClick={closeCelebration} className="btn-glow mt-4 w-full rounded-full no-underline">Levantar</Link>
            ) : d.goal ? <p className="mt-3 text-sm text-muted">Próxima meta: {fmt(d.goal.targetCents)}. Continua!</p> : null}
            <button type="button" onClick={closeCelebration} className={`${celebrate[0].withdraw ? "btn-ghost" : "btn-primary"} mt-2 w-full`}>{celebrate.length > 1 ? "Seguinte" : "Continuar"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
