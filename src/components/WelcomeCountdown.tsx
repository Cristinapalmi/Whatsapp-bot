"use client";
import { useEffect, useState } from "react";

/** Contagem decrescente da oferta de boas-vindas (hora de fim guardada no servidor). */
export function WelcomeCountdown({ until }: { until: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const upd = () => setLeft(Math.max(0, new Date(until).getTime() - Date.now()));
    upd();
    const t = setInterval(upd, 1000);
    return () => clearInterval(t);
  }, [until]);
  if (left === null) return <span className="font-mono">--:--:--</span>;
  const s = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className="font-mono tabular-nums">{pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}</span>;
}
