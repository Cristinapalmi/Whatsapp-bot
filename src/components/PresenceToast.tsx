"use client";
import { useEffect, useState } from "react";

const KEY = "presenca-dia";

/** "+5 pontos de presença" — uma vez por dia quando a pessoa abre a app com conta. */
export function PresenceToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
    try { if (localStorage.getItem(KEY) === today) return; } catch {}
    fetch("/api/presenca", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return; // sem conta: tenta outra vez noutra abertura
        try { localStorage.setItem(KEY, today); } catch {}
        if (d.points) {
          setMsg(`+${d.points} pontos de presença${d.bonus ? ` e +${d.bonus} por ${d.streak} dias seguidos 🔥` : d.streak > 1 ? ` · ${d.streak} dias seguidos` : ""}`);
          setTimeout(() => setMsg(null), 4000);
        }
      })
      .catch(() => {});
  }, []);
  if (!msg) return null;
  return (
    <div role="status" className="fixed inset-x-4 top-3 z-[60] mx-auto max-w-sm rounded-2xl bg-accent px-4 py-3 text-center text-sm font-semibold text-[#1A0E05] shadow-xl">
      {msg}
    </div>
  );
}
