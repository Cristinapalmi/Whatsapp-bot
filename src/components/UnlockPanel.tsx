"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { redeemPointsAction, unlockEpisodeAction } from "@/app/ver/[id]/actions";
import { IconCoin, IconLock, IconStar } from "./icons";
import { AdUnlockButton } from "./AdUnlockButton";

type Props = {
  episodeId: string;
  priceCoins: number;
  balance: number;
  points: number;
  pointsCost: number;
  loggedIn: boolean;
  /** Oferta única com anúncio: true = ainda disponível para esta conta (e há anúncios). */
  adOffer?: boolean;
  /** Se existir, é chamado depois de desbloquear (em vez de recarregar a página). */
  onUnlocked?: (via: "coins" | "points" | "ad") => void;
};

const coins = (n: number) => `${n} ${n === 1 ? "moeda" : "moedas"}`;

/** Botões para desbloquear um episódio: moedas, pontos de fã, ou comprar moedas. */
export function UnlockPanel(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const here = `/ver/${p.episodeId}`;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; code?: string }>, via: "coins" | "points") =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        if (p.onUnlocked) p.onUnlocked(via);
        else {
          router.push(here);
          router.refresh();
        }
      } else if (r.code === "LOGIN") router.push(`/entrar?next=${encodeURIComponent(here)}`);
      else setError(r.error ?? "Erro");
    });

  if (!p.loggedIn)
    return (
      <div className="flex flex-col items-center gap-2">
        <Link href={`/entrar?next=${encodeURIComponent(here)}`} className="btn-primary text-lg">
          <IconLock size={20} /> Entrar para desbloquear
        </Link>
        <p className="text-sm text-muted">Custa {coins(p.priceCoins)}. Criar conta é grátis.</p>
        {p.adOffer && <p className="text-sm text-accent2">Com conta, podes desbloquear 1 episódio grátis com um anúncio (oferta única).</p>}
      </div>
    );

  const enough = p.balance >= p.priceCoins;
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2">
      {enough ? (
        <button type="button" disabled={pending} onClick={() => run(() => unlockEpisodeAction(p.episodeId), "coins")} className="btn-primary w-full text-lg">
          <IconCoin size={20} /> {pending ? "A desbloquear…" : `Desbloqueia por ${coins(p.priceCoins)}`}
        </button>
      ) : (
        <Link href={`/loja?voltar=${encodeURIComponent(here)}`} className="btn-primary w-full text-lg">
          <IconCoin size={20} /> Comprar moedas
        </Link>
      )}
      <p className="text-sm text-muted">
        {enough ? `Tens ${coins(p.balance)}.` : `Este episódio custa ${coins(p.priceCoins)}. Tens ${coins(p.balance)}.`}
      </p>
      {p.adOffer && <AdUnlockButton episodeId={p.episodeId} disabled={pending} onUnlocked={p.onUnlocked ? () => p.onUnlocked!("ad") : undefined} />}
      {p.points >= p.pointsCost && (
        <button type="button" disabled={pending} onClick={() => run(() => redeemPointsAction(p.episodeId), "points")} className="btn-secondary w-full">
          <IconStar size={18} /> Usar {p.pointsCost} dos teus {p.points} pontos
        </button>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
