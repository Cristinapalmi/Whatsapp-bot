import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatKz } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { episodeStates } from "@/domain/access";
import { manualProvider } from "@/domain/payments/providers/manual";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { submitPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Desbloquear episódio" };
export const dynamic = "force-dynamic";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ episodio?: string }> }) {
  const { episodio } = await searchParams;
  const user = await requireUser(`/pagar?episodio=${episodio ?? ""}`);
  if (!episodio) notFound();
  const episode = await db.episode.findFirst({
    where: { id: episodio, published: true, series: { status: "PUBLISHED" } },
    include: { series: { include: { artist: { select: { stageName: true } } } } },
  });
  if (!episode) notFound();
  const state = (await episodeStates(db, user.id, episode.series, [episode]))[episode.id];
  if (state === "free" || state === "unlocked") redirect(`/ver/${episode.id}`);

  const amount = episode.series.priceCents;
  const instructions = await manualProvider.initiate({ paymentRequestId: "", amountCents: amount, description: "" });

  return (
    <div className="container-app max-w-lg py-4">
      <h1 className="text-2xl font-bold">Desbloquear episódio {episode.number}</h1>
      <p className="mt-1 text-muted">{episode.series.title} · {episode.series.artist.stageName}</p>

      {state === "pending" ? (
        <div className="card mt-6">
          <p className="font-semibold text-warn">Já enviaste um pedido para este episódio.</p>
          <p className="mt-1 text-sm text-muted">Está a aguardar confirmação. Avisamos-te assim que estiver pronto.</p>
          <Link href="/conta" className="btn-secondary mt-4">Ver os meus pedidos</Link>
        </div>
      ) : (
        <>
          <div className="card mt-6">
            <p className="text-sm text-muted">Valor</p>
            <p className="font-display text-4xl font-extrabold text-accent">{formatKz(amount)}</p>
            <p className="mt-2 text-sm text-muted">Metade deste valor vai diretamente para {episode.series.artist.stageName}.</p>
          </div>

          <h2 className="mt-6 text-lg font-bold">1. Faz a transferência</h2>
          {instructions.type === "instructions" && (
            <dl className="card mt-2 divide-y divide-white/5">
              {instructions.lines.map((l) => (
                <div key={l.label} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-sm text-muted">{l.label}</dt>
                  <dd className="flex items-center gap-1 text-right font-semibold">
                    {l.value}
                    {!l.label.startsWith("Valor") && <CopyButton text={l.value.replace(/\s/g, "")} label={`Copiar ${l.label}`} />}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <h2 className="mt-6 text-lg font-bold">2. Envia o comprovativo</h2>
          <ActionForm action={submitPaymentAction} className="mt-2 space-y-4">
            <input type="hidden" name="episodeId" value={episode.id} />
            <fieldset>
              <legend className="label">Como pagaste?</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="card flex min-h-tap cursor-pointer items-center gap-2 has-[:checked]:ring-2 has-[:checked]:ring-accent">
                  <input type="radio" name="method" value="MULTICAIXA_EXPRESS" defaultChecked className="accent-accent" /> Multicaixa Express
                </label>
                <label className="card flex min-h-tap cursor-pointer items-center gap-2 has-[:checked]:ring-2 has-[:checked]:ring-accent">
                  <input type="radio" name="method" value="BANK_TRANSFER" className="accent-accent" /> Transferência
                </label>
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="payerPhone">Número de onde pagaste</label>
              <input className="input" id="payerPhone" name="payerPhone" type="tel" inputMode="tel" defaultValue={formatPhone(user.phone)} required />
            </div>
            <div>
              <label className="label" htmlFor="transactionRef">N.º da operação</label>
              <input className="input" id="transactionRef" name="transactionRef" placeholder="Aparece no comprovativo" required />
              <p className="hint">Cada comprovativo só pode ser usado uma vez.</p>
            </div>
            <div>
              <label className="label" htmlFor="proof">Fotografia ou captura do comprovativo</label>
              <input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-[#1A0E05]" id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
              <p className="hint">JPG, PNG ou PDF, até 5 MB.</p>
            </div>
            <SubmitButton pendingText="A enviar comprovativo…">Enviar comprovativo</SubmitButton>
            <p className="text-center text-xs text-muted">Depois de enviar, o pedido fica "A aguardar confirmação". Normalmente confirmamos no próprio dia.</p>
          </ActionForm>
        </>
      )}
    </div>
  );
}
