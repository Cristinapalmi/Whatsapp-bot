"use client";
import { useState } from "react";

/** Calculadora "quanto posso ganhar" — ESTIMATIVA com as regras atuais, nunca uma garantia. */
export function EarningsCalculator({ prices, coinKz, share, founderShare }: { prices: { ENTRY: number; NORMAL: number; PREMIUM: number }; coinKz: number; share: number; founderShare: number | null }) {
  const [fans, setFans] = useState(200);
  const [eps, setEps] = useState(10);
  const [tier, setTier] = useState<"ENTRY" | "NORMAL" | "PREMIUM">("ENTRY");
  const [founder, setFounder] = useState(false);
  const paidEps = Math.max(0, eps - 3);
  const pct = founder && founderShare ? founderShare : share;
  const kz = Math.round(fans * paidEps * prices[tier] * coinKz * (pct / 100));
  return (
    <div className="card space-y-3">
      <div>
        <label className="label" htmlFor="calc-fans">Fãs que veem a série até ao fim: <strong>{fans.toLocaleString("pt-AO")}</strong></label>
        <input id="calc-fans" type="range" min={10} max={5000} step={10} value={fans} onChange={(e) => setFans(+e.target.value)} className="w-full accent-[rgb(var(--c-accent))]" />
      </div>
      <div>
        <label className="label" htmlFor="calc-eps">Episódios da série: <strong>{eps}</strong> (os 3 primeiros são grátis)</label>
        <input id="calc-eps" type="range" min={4} max={60} value={eps} onChange={(e) => setEps(+e.target.value)} className="w-full accent-[rgb(var(--c-accent))]" />
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["ENTRY", "NORMAL", "PREMIUM"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTier(t)} className={`btn-sm ${tier === t ? "btn-primary" : "btn-secondary"}`} aria-pressed={tier === t}>
            {t === "ENTRY" ? "Entrada" : t === "NORMAL" ? "Normal" : "Premium"} · {prices[t]} moedas
          </button>
        ))}
      </div>
      {founderShare && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={founder} onChange={(e) => setFounder(e.target.checked)} className="checkbox mt-0" /> Sou Artista Fundador (primeiros meses)</label>
      )}
      <div className="rounded-2xl bg-accent/15 p-4 text-center">
        <p className="text-sm text-muted">Podes ganhar cerca de</p>
        <p className="font-display text-3xl font-extrabold text-accent">{kz.toLocaleString("pt-AO")} Kz</p>
        <p className="mt-1 text-xs text-muted">Estimativa, não é garantia. Depende de quantas pessoas desbloqueiam os teus episódios. Não conta presentes, bónus nem anúncios.</p>
      </div>
    </div>
  );
}
