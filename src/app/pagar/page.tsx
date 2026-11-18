import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { coinsLabel, formatKz, kzToCents } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { manualProvider } from "@/domain/payments/providers/manual";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { IconCoin } from "@/components/icons";
import { submitPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Comprar moedas" };
export const dynamic = "force-dynamic";

type Search = { pacote?: string; voltar?: string; episodio?: string; passe?: string; presente?: string };

export default async function PayPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  // Endereços antigos (compra direta de episódio, passe ou presente em Kz) levam ao sítio certo
  if (sp.episodio) redirect(`/ver/${sp.episodio}`);
  if (sp.passe) redirect("/membro");
  if (!sp.pacote) redirect("/loja");

  const user = await requireUser(`/pagar?pacote=${sp.pacote}`);
  const pack = await db.coinPack.findFirst({ where: { id: sp.pacote, active: true } });
  if (!pack) notFound();
  const amount = kzToCents(pack.priceKz);
  const alreadyPending = await db.paymentRequest.count({ where: { userId: user.id, status: "PENDING", kind: "COINS" } });
  const instructions = await manualProvider.initiate({ paymentRequestId: "", amountCents: amount, description: `${pack.coins} moedas` });

  return (
    <div className="container-app max-w-lg py-4">
      <Link href="/loja" className="text-sm text-muted">← Loja</Link>
      <h1 className="mt-1 text-2xl font-bold">Comprar {coinsLabel(pack.coins)}</h1>

      <div className="card mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Vais receber</p>
          <p className="flex items-center gap-2 font-display text-3xl font-extrabold text-accent2"><IconCoin size={26} /> {coinsLabel(pack.coins)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Valor</p>
          <p className="font-display text-3xl font-extrabold text-accent">{formatKz(amount)}</p>
        </div>
      </div>
      {alreadyPending > 0 && (
        <p className="mt-3 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">Já tens {alreadyPending} pedido(s) de moedas a aguardar confirmação.</p>
      )}

      <h2 className="mt-6 text-lg font-bold">1. Faz a transferência</h2>
      {instructions.type === "instructions" && (
        <dl className="card mt-2 divide-y divide-white/5">
          {instructions.lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-sm text-muted">{l.label}</dt>
              <dd className="flex items-center gap-1 text-right font-semibold">
                {l.value}
                {(l.label.includes("número") || l.label.includes("IBAN")) && <CopyButton text={l.value.replace(/\s/g, "")} label={`Copiar ${l.label}`} />}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <h2 className="mt-6 text-lg font-bold">2. Envia o comprovativo</h2>
      <ActionForm action={submitPaymentAction} className="mt-2 space-y-4">
        <input type="hidden" name="packId" value={pack.id} />
        <input type="hidden" name="voltar" value={sp.voltar ?? ""} />
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
        <p className="text-center text-xs text-muted">As moedas entram na tua carteira assim que confirmarmos o pagamento (normalmente no próprio dia). As moedas não são reembolsáveis, não se transferem e não se trocam por dinheiro.</p>
      </ActionForm>
    </div>
  );
}
