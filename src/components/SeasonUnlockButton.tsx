"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unlockSeasonAction } from "@/app/ver/[id]/actions";
import { IconCoin } from "./icons";

export type SeasonOffer = { count: number; fullPrice: number; price: number; discountPercent: number };

/** "Desbloquear todos os episódios restantes" com desconto — uma só cobrança. */
export function SeasonUnlockButton({ seriesId, offer, balance, onUnlocked, className = "btn-secondary w-full" }: {
  seriesId: string; offer: SeasonOffer; balance: number; onUnlocked?: () => void; className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const enough = balance >= offer.price;
  return (
    <div className="w-full">
      <button
        type="button"
        disabled={pending || !enough}
        className={className}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await unlockSeasonAction(seriesId);
            if (r.ok) {
              setMsg({ ok: true, text: r.message ?? "Desbloqueado!" });
              if (onUnlocked) onUnlocked();
              else router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        <IconCoin size={18} /> {pending ? "A desbloquear…" : `Desbloquear temporada (-${offer.discountPercent}%) · ${offer.price} moedas`}
      </button>
      <p className="mt-1 text-center text-xs text-muted">
        Os {offer.count} episódios que faltam: <s>{offer.fullPrice}</s> {offer.price} moedas{enough ? "" : ` · tens ${balance}`}
      </p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 text-center text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
