"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { redeemPointsAction, startWelcomeOfferAction, unlockEpisodeAction } from "@/app/ver/[id]/actions";
import { submitPaymentInlineAction } from "@/app/pagar/actions";
import type { ActionResult } from "./ActionForm";
import { AdUnlockButton } from "./AdUnlockButton";
import { CopyButton } from "./CopyButton";
import { WelcomeCountdown } from "./WelcomeCountdown";
import { SeasonUnlockButton, type SeasonOffer } from "./SeasonUnlockButton";
import { IconChevronLeft, IconCoin, IconCrown, IconLock, IconStar, IconX } from "./icons";

export type SheetPack = { id: string; priceKz: number; coins: number; bonusPercent: number };
export type SheetWelcome = { packId: string; bonusCoins: number; expiresAt: string | null } | null;
export type SheetSeason = (SeasonOffer & { episodeIds: string[] }) | null;

type Props = {
  episodeId: string;
  episodeNumber: number;
  seriesId: string;
  priceCoins: number;
  balance: number;
  points: number;
  pointsCost: number;
  loggedIn: boolean;
  adOffer: boolean;
  season: SheetSeason;
  packs: SheetPack[];
  welcome: SheetWelcome;
  payLines: { label: string; value: string }[];
  payerPhone: string;
  hook: string | null;
  arrivedFromAd: boolean;
  pendingPayment: boolean;
  onUnlocked: (via: "coins" | "points" | "ad") => void;
  onSeasonUnlocked: (ids: string[], coins: number) => void;
  onBalance: (n: number) => void;
  onClose: () => void;
  onEpisodes: () => void;
};

const kz = (n: number) => `${n.toLocaleString("pt-AO")} Kz`;

/**
 * PAINEL DE DESBLOQUEIO (estilo DramaBox): sobe por cima do vídeo desfocado.
 * Com moedas: desbloquear o episódio ou a temporada. Sem moedas: pacotes logo aqui,
 * o pagamento faz-se sem sair da série e o painel volta quando as moedas entrarem.
 */
export function UnlockSheet(p: Props) {
  const router = useRouter();
  const here = `/ver/${p.episodeId}`;
  const [step, setStep] = useState<"main" | "pay" | "sent">(p.pendingPayment && p.balance < p.priceCoins ? "sent" : "main");
  const [pack, setPack] = useState<SheetPack | null>(null);
  const [welcome, setWelcome] = useState<SheetWelcome>(p.welcome);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payState, payAction] = useActionState<ActionResult, FormData>(submitPaymentInlineAction, null);
  const enough = p.balance >= p.priceCoins;
  const balanceRef = useRef(p.balance);
  balanceRef.current = p.balance;

  // Oferta de boas-vindas: a contagem começa na 1.ª vez que os pacotes aparecem (guardado no servidor)
  const showingPacks = p.loggedIn && !enough && step === "main";
  useEffect(() => {
    if (showingPacks && welcome && !welcome.expiresAt)
      startWelcomeOfferAction().then((r) => setWelcome((w) => (w && r.expiresAt ? { ...w, expiresAt: r.expiresAt } : r.expiresAt ? w : null)));
  }, [showingPacks, welcome]);

  useEffect(() => {
    if (payState?.ok) setStep("sent");
  }, [payState]);

  // À espera da confirmação: perguntar o saldo de vez em quando
  useEffect(() => {
    if (step !== "sent") return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/moedas/saldo", { cache: "no-store" }).then((x) => x.json());
        if (stop) return;
        if (typeof r.balance === "number" && r.balance > balanceRef.current) {
          p.onBalance(r.balance);
          setStep("main");
        } else if (r.pending === 0) {
          // Nada pendente e o saldo não subiu: o pagamento foi recusado
          setStep("main");
          setError("O pagamento não foi confirmado. Vê o motivo nas notificações.");
        }
      } catch {}
    };
    const t = setInterval(tick, 15000);
    tick();
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; code?: string }>, via: "coins" | "points") =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) p.onUnlocked(via);
      else if (r.code === "LOGIN") router.push(`/entrar?next=${encodeURIComponent(here)}`);
      else setError(r.error ?? "Erro");
    });

  // Quando a oferta acaba, desaparece sozinha
  useEffect(() => {
    if (!welcome?.expiresAt) return;
    const ms = new Date(welcome.expiresAt).getTime() - Date.now();
    const t = setTimeout(() => setWelcome(null), Math.max(0, Math.min(ms, 2_147_000_000)));
    return () => clearTimeout(t);
  }, [welcome?.expiresAt]);
  const welcomeActive = !!(welcome && welcome.expiresAt);
  const packCoins = (pk: SheetPack) => pk.coins + (welcomeActive && welcome!.packId === pk.id ? welcome!.bonusCoins : 0);
  const orderedPacks = welcomeActive ? [...p.packs].sort((a, b) => (a.id === welcome!.packId ? -1 : b.id === welcome!.packId ? 1 : 0)) : p.packs;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur" data-noswipe role="dialog" aria-label={`Desbloquear episódio ${p.episodeNumber}`}>
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />

      {/* Topo: preço e saldo */}
      <div className="flex items-center justify-between gap-2">
        {step === "pay" ? (
          <button type="button" onClick={() => setStep("main")} className="btn-ghost btn-sm -ml-2"><IconChevronLeft size={18} /> Voltar</button>
        ) : (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted">Este episódio: <strong className="inline-flex items-center gap-1 text-fg"><IconCoin size={14} className="text-accent2" />{p.priceCoins}</strong></span>
            {p.loggedIn && <span className="text-muted">Saldo: <strong className="inline-flex items-center gap-1 text-fg"><IconCoin size={14} className="text-accent2" />{p.balance}</strong></span>}
          </p>
        )}
        <button type="button" onClick={p.onClose} className="btn-ghost btn-sm" aria-label="Fechar"><IconX size={20} /></button>
      </div>

      {step === "main" && (
        <>
          {p.arrivedFromAd ? (
            <p className="mt-2 font-display text-xl font-extrabold text-accent2">Gostaste? Continua já.</p>
          ) : p.hook ? (
            <div className="mt-2">
              <p className="font-display text-xl font-extrabold text-accent2">Queres saber o que acontece?</p>
              <p className="text-sm text-fg/90">{p.hook}</p>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-2 font-display text-xl font-extrabold"><IconLock size={18} className="text-accent" /> Episódio {p.episodeNumber}</p>
          )}

          <div className="mt-3 space-y-2">
            {!p.loggedIn ? (
              <>
                <Link href={`/entrar?next=${encodeURIComponent(here)}`} className="btn-primary w-full text-lg"><IconLock size={20} /> Entrar para desbloquear</Link>
                <p className="text-center text-xs text-muted">Criar conta é grátis.{p.adOffer ? " Com conta, podes ver 1 episódio grátis com um anúncio (oferta única)." : ""}</p>
              </>
            ) : enough ? (
              <>
                <button type="button" disabled={busy} onClick={() => run(() => unlockEpisodeAction(p.episodeId), "coins")} className="btn-primary w-full text-lg">
                  <IconCoin size={20} /> {busy ? "A desbloquear…" : `Desbloquear por ${p.priceCoins} moedas`}
                </button>
                {p.season && <SeasonUnlockButton seriesId={p.seriesId} offer={p.season} balance={p.balance} onUnlocked={() => p.onSeasonUnlocked(p.season!.episodeIds, p.season!.price)} />}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Recarrega para continuar a ver</p>
                <ul className="grid grid-cols-2 gap-2">
                  {orderedPacks.map((pk) => {
                    const isWelcome = welcomeActive && welcome!.packId === pk.id;
                    return (
                      <li key={pk.id}>
                        <button
                          type="button"
                          onClick={() => { setPack(pk); setStep("pay"); }}
                          className={`relative flex h-full w-full flex-col items-start rounded-2xl border p-3 text-left transition ${isWelcome ? "border-accent bg-accent/10" : "border-white/10 bg-surface2 hover:border-accent"}`}
                        >
                          {isWelcome ? (
                            <span className="absolute -top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-[#1A0E05]">Oferta de boas-vindas</span>
                          ) : pk.bonusPercent > 0 ? (
                            <span className="absolute -top-2 right-2 rounded-full bg-accent2 px-2 py-0.5 text-[10px] font-bold text-[#1A0E05]">+{pk.bonusPercent}%</span>
                          ) : null}
                          <span className="mt-1 flex items-center gap-1 font-display text-xl font-extrabold"><IconCoin size={18} className="text-accent2" />{isWelcome ? `${pk.coins}+${welcome!.bonusCoins}` : pk.coins}</span>
                          <span className="text-sm font-semibold text-accent">{kz(pk.priceKz)}</span>
                          {isWelcome && welcome!.expiresAt && (
                            <span className="text-[11px] text-muted">Acaba em <WelcomeCountdown until={welcome!.expiresAt} /></span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {p.loggedIn && p.adOffer && <AdUnlockButton episodeId={p.episodeId} disabled={busy} onUnlocked={() => p.onUnlocked("ad")} />}
            {p.loggedIn && p.points >= p.pointsCost && (
              <button type="button" disabled={busy} onClick={() => run(() => redeemPointsAction(p.episodeId), "points")} className="btn-secondary w-full">
                <IconStar size={18} /> Usar {p.pointsCost} dos teus {p.points} pontos
              </button>
            )}
            {error && <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 opacity-80">
              <IconCrown size={22} className="shrink-0 text-accent2" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Membro</p>
                <p className="text-xs text-muted">Episódios sem limites.</p>
              </div>
              <span className="badge-muted">Brevemente</span>
            </div>

            <details className="text-xs text-muted">
              <summary className="cursor-pointer py-1">Instruções de recarga</summary>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Escolhe um pacote.</li>
                <li>Paga por Multicaixa Express ou transferência.</li>
                <li>Envia a foto do comprovativo e o n.º da operação.</li>
                <li>As moedas entram quando confirmarmos (normalmente no mesmo dia). Avisamos-te.</li>
              </ol>
              <p className="mt-1">As moedas não têm prazo, mas não são reembolsáveis e não se trocam por dinheiro.</p>
            </details>
            <button type="button" onClick={p.onEpisodes} className="btn-ghost btn-sm w-full text-muted">Ver todos os episódios</button>
          </div>
        </>
      )}

      {step === "pay" && pack && (
        <form action={payAction} className="mt-2 space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-surface2 p-3">
            <span className="flex items-center gap-1 font-display text-2xl font-extrabold text-accent2"><IconCoin size={22} />{packCoins(pack)}</span>
            <span className="font-display text-2xl font-extrabold text-accent">{kz(pack.priceKz)}</span>
          </div>
          <p className="text-sm font-semibold">1. Faz a transferência</p>
          <dl className="divide-y divide-white/5 rounded-2xl bg-surface2 px-3">
            {[{ label: "Valor a transferir", value: kz(pack.priceKz) }, ...p.payLines].map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-2 py-2 text-sm">
                <dt className="text-muted">{l.label}</dt>
                <dd className="flex items-center gap-1 text-right font-semibold">
                  {l.value}
                  {(l.label.includes("número") || l.label.includes("IBAN")) && <CopyButton text={l.value.replace(/\s/g, "")} label={`Copiar ${l.label}`} />}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm font-semibold">2. Envia o comprovativo</p>
          <input type="hidden" name="packId" value={pack.id} />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex min-h-tap cursor-pointer items-center gap-2 rounded-xl bg-surface2 px-3 has-[:checked]:ring-2 has-[:checked]:ring-accent">
              <input type="radio" name="method" value="MULTICAIXA_EXPRESS" defaultChecked className="accent-accent" /> Multicaixa Express
            </label>
            <label className="flex min-h-tap cursor-pointer items-center gap-2 rounded-xl bg-surface2 px-3 has-[:checked]:ring-2 has-[:checked]:ring-accent">
              <input type="radio" name="method" value="BANK_TRANSFER" className="accent-accent" /> Transferência
            </label>
          </div>
          <div>
            <label className="label" htmlFor="sheet-phone">Número de onde pagaste</label>
            <input className="input" id="sheet-phone" name="payerPhone" type="tel" inputMode="tel" defaultValue={p.payerPhone} required />
          </div>
          <div>
            <label className="label" htmlFor="sheet-ref">N.º da operação</label>
            <input className="input" id="sheet-ref" name="transactionRef" placeholder="Aparece no comprovativo" required />
          </div>
          <div>
            <label className="label" htmlFor="sheet-proof">Foto ou captura do comprovativo</label>
            <input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-[#1A0E05]" id="sheet-proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
          </div>
          {payState?.error && <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">{payState.error}</p>}
          <PaySubmit />
        </form>
      )}

      {step === "sent" && (
        <div className="mt-3 space-y-2 text-center">
          <p className="font-display text-xl font-extrabold text-ok">Comprovativo enviado ✅</p>
          <p className="text-sm text-fg/90">Estamos a confirmar o teu pagamento. Quando as moedas entrarem, este painel atualiza-se sozinho e podes desbloquear logo.</p>
          <p className="text-xs text-muted">Podes fechar e ver os episódios grátis. Também te avisamos nas notificações.</p>
          <button type="button" onClick={p.onClose} className="btn-secondary w-full">Fechar</button>
        </div>
      )}
    </div>
  );
}

function PaySubmit() {
  // useFormStatus precisa de estar dentro do <form>
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "A enviar comprovativo…" : "Enviar comprovativo"}</button>
  );
}
