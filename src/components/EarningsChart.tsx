"use client";
import { useState } from "react";

type Bucket = { start: string; cents: number };

const kz = (c: number) => `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(c / 100)} Kz`;
const label = (iso: string, by: "day" | "week") =>
  new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "short", timeZone: "Africa/Luanda" }).format(new Date(iso)) + (by === "week" ? " (semana)" : "");

/** Histórico de ganhos: barras por dia (30 dias) ou por semana (12 semanas). Uma só série, dados reais. */
export function EarningsChart({ days, weeks }: { days: Bucket[]; weeks: Bucket[] }) {
  const [by, setBy] = useState<"day" | "week">("day");
  const [hover, setHover] = useState<number | null>(null);
  const data = by === "day" ? days : weeks;
  const max = Math.max(...data.map((d) => d.cents), 1);
  const sum = data.reduce((a, d) => a + d.cents, 0);
  const W = 100 / data.length;
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Histórico de ganhos</h2>
        <div className="flex gap-1" role="group" aria-label="Agrupar por">
          {(["day", "week"] as const).map((k) => (
            <button key={k} type="button" onClick={() => { setBy(k); setHover(null); }} className={`btn-sm ${by === k ? "btn-primary" : "btn-ghost border border-white/10"}`} aria-pressed={by === k}>
              {k === "day" ? "Dia" : "Semana"}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">{by === "day" ? "Últimos 30 dias" : "Últimas 12 semanas"}: <strong className="text-fg">{kz(sum)}</strong></p>
      <p className="mt-1 h-5 text-sm" aria-live="polite">{h ? <><span className="text-muted">{label(h.start, by)}:</span> <strong>{kz(h.cents)}</strong></> : <span className="text-xs text-muted">Toca numa barra para ver o valor.</span>}</p>
      <div className="relative mt-1 h-36" onMouseLeave={() => setHover(null)}>
        {/* linha de base discreta */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => (
            <button
              key={d.start}
              type="button"
              className="group flex h-full items-end justify-center px-[1px]"
              style={{ width: `${W}%` }}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${label(d.start, by)}: ${kz(d.cents)}`}
            >
              <span
                className={`block w-full max-w-[14px] rounded-t-[4px] transition-colors ${d.cents > 0 ? (hover === i ? "bg-accent2" : "bg-accent") : "bg-white/10"}`}
                style={{ height: d.cents > 0 ? `${Math.max(4, (d.cents / max) * 100)}%` : "2px" }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{label(data[0].start, by)}</span>
        <span>{by === "day" ? "hoje" : "esta semana"}</span>
      </div>
      {sum === 0 && <p className="mt-2 text-xs text-muted">Ainda sem ganhos neste período. Quando os fãs desbloquearem episódios, as barras crescem aqui.</p>}
      <table className="sr-only">
        <caption>Ganhos por {by === "day" ? "dia" : "semana"}</caption>
        <tbody>{data.map((d) => <tr key={d.start}><th>{label(d.start, by)}</th><td>{kz(d.cents)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
