"use client";
import { useEffect, useRef, useState } from "react";

const fmt = (cents: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100) + " Kz";

/** Saldo que se atualiza sozinho (a cada 15 s) e "conta" até ao novo valor. */
export function LiveWallet({ initialCents }: { initialCents: number }) {
  const [shown, setShown] = useState(initialCents);
  const [flash, setFlash] = useState(false);
  const target = useRef(initialCents);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/artista/carteira", { cache: "no-store" });
        if (!r.ok) return;
        const w = await r.json();
        if (typeof w.availableCents === "number" && w.availableCents !== target.current) {
          const from = target.current;
          target.current = w.availableCents;
          if (w.availableCents > from) setFlash(true);
          const start = performance.now();
          const step = (t: number) => {
            const k = Math.min(1, (t - start) / 1200);
            setShown(Math.round(from + (w.availableCents - from) * k));
            if (k < 1) requestAnimationFrame(step);
            else setTimeout(() => setFlash(false), 800);
          };
          requestAnimationFrame(step);
        }
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className={`font-display text-4xl font-extrabold transition-colors sm:text-5xl ${flash ? "text-ok" : "text-accent"}`} aria-live="polite">
      {fmt(shown)}
    </p>
  );
}
