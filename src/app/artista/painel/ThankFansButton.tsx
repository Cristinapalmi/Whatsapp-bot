"use client";
import { useState } from "react";

/** "Agradecer aos fãs no TikTok": abre a partilha com um texto pronto (sem valores em dinheiro). */
export function ThankFansButton({ names, artistName, link }: { names: string[]; artistName: string; link: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const text = `Obrigado aos meus maiores fãs na KONTA: ${names.join(", ")} 🙏🔥 Vocês fazem as minhas séries crescer! Vejam as minhas séries aqui 👉 ${link} — ${artistName}`;
  return (
    <div className="mt-2">
      <button
        type="button"
        className="btn-secondary btn-sm w-full"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ text });
            else { await navigator.clipboard.writeText(text); setMsg("Texto copiado. Cola no TikTok."); }
          } catch {}
        }}
      >
        Agradecer aos fãs no TikTok
      </button>
      {msg && <p className="mt-1 text-center text-xs text-muted">{msg}</p>}
    </div>
  );
}
