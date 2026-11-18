"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArtistMoneySnapshot } from "@/domain/artists/growth";
import { IconClock, IconTrophy, IconWallet } from "./icons";

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100) + " Kz";

/** Número que "conta" suavemente até ao novo valor. */
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
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

/** Mini gráfico dos últimos 7 dias (o último é hoje, ao vivo). */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-12 shrink-0 items-end gap-1" aria-label="Ganhos dos últimos 7 dias" role="img">
      {values.map((v, i) => (
        <span key={i} className={`w-2.5 rounded-t-[3px] ${i === values.length - 1 ? "bg-accent2" : "bg-accent2/50"}`} style={{ height: v > 0 ? `${Math.max(12, (v / max) * 100)}%` : "3px" }} title={fmt(v)} />
      ))}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

/**
 * PAINEL FINANCEIRO DO ARTISTA — 4 valores reais da carteira (livro-razão), atualizados ao vivo:
 * Ganhos totais · Pendente · Disponível · Levantado. Mais a próxima conquista (bónus de marco),
 * a próxima meta de ganhos e a animação quando uma conquista acontece. Nada é inventado.
 */
export function ArtistMoneyPanel({ initial, last7 = [] }: { initial: ArtistMoneySnapshot; last7?: number[] }) {
  const [s, setS] = useState(initial);
  const [gain, setGain] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<ArtistMoneySnapshot["achievements"]>(initial.achievements);
  const lastTotal = useRef(initial.totalCents);
  const shownIds = useRef(new Set(initial.achievements.map((a) => a.id)));
  const total = useCountUp(s.totalCents);
  const available = useCountUp(s.availableCents);
  const today = useCountUp(s.todayCents);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/artista/carteira", { cache: "no-store" });
        if (!r.ok) return;
        const { snapshot } = (await r.json()) as { snapshot: ArtistMoneySnapshot };
        if (snapshot.totalCents > lastTotal.current) {
          setGain(snapshot.totalCents - lastTotal.current);
          setTimeout(() => setGain(null), 3500);
        }
        lastTotal.current = snapshot.totalCents;
        setS(snapshot);
        const fresh = snapshot.achievements.filter((a) => !shownIds.current.has(a.id));
        if (fresh.length) {
          fresh.forEach((a) => shownIds.current.add(a.id));
          setCelebrate((c) => [...c, ...fresh]);
        }
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

  const canWithdraw = s.availableCents >= s.minPayoutCents;
  const goalPct = s.goal ? ((s.totalCents - s.goal.fromCents) / (s.goal.targetCents - s.goal.fromCents)) * 100 : 100;
  const r = s.nextReward;

  return (
    <section className="mt-4 space-y-3">
      {/* Os teus ganhos na KONTA (cartão dourado) */}
      <div className="relative overflow-hidden rounded-3xl border border-accent2/40 bg-gradient-to-br from-accent2/35 via-accent/15 to-surface p-5 shadow-[0_10px_40px_-15px_rgb(var(--c-accent2)/0.6)]">
        <p className="flex items-center gap-2 text-sm font-semibold text-accent2"><IconWallet size={18} /> Os teus ganhos na KONTA</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-4xl font-extrabold text-fg sm:text-5xl" aria-live="polite">{fmt(total)}</p>
            <p className="mt-1 text-sm">
              <span className={s.todayCents > 0 ? "font-semibold text-ok" : "text-muted"}>{s.todayCents > 0 ? `▲ +${fmt(today)} hoje` : "Hoje ainda sem ganhos"}</span>
              <span className="text-muted"> · {fmt(s.monthCents)} este mês</span>
            </p>
          </div>
          {last7.length > 0 && <Spark values={[...last7.slice(0, -1), s.todayCents]} />}
        </div>
        {gain !== null && (
          <span className="absolute right-4 top-4 animate-[giftpop_3.2s_ease-out_forwards] rounded-full bg-ok px-3 py-1 text-sm font-bold text-[#06210F]">+{fmt(gain)}</span>
        )}
        <p className="mt-2 text-xs text-muted">Atualiza sozinho. Cada desbloqueio nas tuas séries entra aqui.</p>
      </div>

      {/* Pendente · Disponível · Levantado */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-warn/30 bg-warn/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warn"><IconClock size={14} /> Pendente</p>
          <p className="mt-1 font-display text-2xl font-bold">{fmt(s.pendingCents)}</p>
          {s.pendingSchedule.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {s.pendingSchedule.slice(0, 3).map((p) => (
                <li key={p.availableAt}>{fmt(p.cents)} · {p.daysLeft === 0 ? "disponível hoje" : `disponível em ${p.daysLeft} ${p.daysLeft === 1 ? "dia" : "dias"}`}</li>
              ))}
              {s.pendingSchedule.length > 3 && <li>e mais {s.pendingSchedule.length - 3} datas…</li>}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted">Nada pendente. Cada ganho novo fica aqui uns dias e depois passa sozinho a Disponível.</p>
          )}
        </div>
        <div className="rounded-2xl border border-ok/40 bg-ok/10 p-4">
          <p className="text-xs font-semibold text-ok">Disponível</p>
          <p className="mt-1 font-display text-2xl font-bold text-ok">{fmt(available)}</p>
          {canWithdraw ? (
            <Link href="/artista/carteira#levantar" className="btn-primary btn-sm mt-2 w-full no-underline">Levantar</Link>
          ) : (
            <p className="mt-1 text-xs text-muted">Podes levantar a partir de {fmt(s.minPayoutCents)} · faltam {fmt(Math.max(0, s.minPayoutCents - s.availableCents))}</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <p className="text-xs font-semibold text-muted">Levantado</p>
          <p className="mt-1 font-display text-2xl font-bold">{fmt(s.withdrawnCents)}</p>
          <p className="mt-1 text-xs text-muted">{s.processingCents > 0 ? `${fmt(s.processingCents)} a caminho da tua conta.` : "Já transferido para a tua conta."}</p>
        </div>
      </div>
      <p className="text-xs text-muted">🔒 O teu dinheiro fica registado em cada movimento. Vê tudo em <Link href="/artista/carteira" className="underline">Carteira</Link> e no extrato mensal.</p>

      {/* Próxima conquista (bónus real) */}
      {r && (
        <div className="card">
          <p className="flex items-center gap-2 text-sm font-semibold"><IconTrophy size={18} className="text-accent2" /> Próxima conquista</p>
          <p className="mt-1 text-sm">
            <strong>{r.target.toLocaleString("pt-AO")} desbloqueios</strong> em “{r.seriesTitle}” — já tens {r.unlocks.toLocaleString("pt-AO")} — faltam <strong>{(r.target - r.unlocks).toLocaleString("pt-AO")}</strong>
            {r.bonusCents > 0 ? <> para o bónus de <strong className="text-accent">{fmt(r.bonusCents)}</strong></> : null}{r.crown ? " e a coroa 👑" : ""} 🔥
          </p>
          <Bar pct={(r.unlocks / r.target) * 100} />
        </div>
      )}

      {/* Próxima meta de ganhos (celebração) */}
      {s.goal && (
        <div className="card">
          <p className="text-sm font-semibold">Próxima meta: {fmt(s.goal.targetCents)}</p>
          <p className="mt-1 text-sm text-muted">Já acumulaste {fmt(s.totalCents)} — faltam <strong className="text-fg">{fmt(Math.max(0, s.goal.targetCents - s.totalCents))}</strong> 🔥</p>
          <Bar pct={goalPct} />
          <p className="mt-1 text-xs text-muted">{s.goalsReached > 0 ? `${s.goalsReached} ${s.goalsReached === 1 ? "meta atingida" : "metas atingidas"} até agora. ` : ""}As metas são só para acompanhares o teu crescimento — nunca impedem levantamentos.</p>
        </div>
      )}

      {/* Animação de conquista (só conquistas reais e novas) */}
      {celebrate.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6" role="dialog" aria-label="Conquista">
          <div className="w-full max-w-sm animate-[giftpop_0.6s_ease-out_both] rounded-3xl bg-surface p-6 text-center shadow-2xl" style={{ animationFillMode: "both" }}>
            <p className="text-6xl" aria-hidden>🏆</p>
            <p className="mt-2 font-display text-2xl font-extrabold text-accent2">Parabéns!</p>
            <p className="mt-1 text-fg">{celebrate[0].title}</p>
            {celebrate[0].prizeCents > 0 && <p className="mt-2 rounded-xl bg-ok/15 px-3 py-2 font-semibold text-ok">Recebeste um bónus de {fmt(celebrate[0].prizeCents)} na tua carteira.</p>}
            {s.goal && <p className="mt-3 text-sm text-muted">Próxima meta: {fmt(s.goal.targetCents)}. Continua!</p>}
            <button type="button" onClick={closeCelebration} className="btn-primary mt-4 w-full">{celebrate.length > 1 ? "Seguinte" : "Continuar"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
