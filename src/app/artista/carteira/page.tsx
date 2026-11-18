import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatIban } from "@/lib/iban";
import { formatPhone } from "@/lib/phone";
import { getArtistWallet } from "@/domain/money/ledger";
import { artistAvailable } from "@/domain/money/accounts";
import { payoutMinCents } from "@/domain/payouts/service";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { LiveWallet } from "@/components/LiveWallet";
import { PayoutStatusBadge } from "@/components/StatusBadge";
import { PayoutAccountForm } from "./PayoutAccountForm";
import { requestPayoutAction } from "./actions";

export const metadata: Metadata = { title: "Carteira" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  PAYMENT_CONFIRMED: "Pagamento do público",
  PAYMENT_REVERSED: "Pagamento anulado",
  PAYOUT_REQUESTED: "Pedido de levantamento",
  PAYOUT_REJECTED: "Levantamento devolvido",
  PASS_DISTRIBUTION: "Passe semanal",
  PASS_ROLLOVER: "Passe semanal",
  COIN_SPEND_EPISODE: "Episódio desbloqueado",
  COIN_SPEND_GIFT: "Presente recebido",
  COIN_SPEND_REVERSED: "Ganho anulado",
  AD_DISTRIBUTION: "Anúncios do mês",
  ARTIST_BONUS: "Bónus 🏆",
};

export default async function WalletPage() {
  const { artist } = await requireArtist({ approved: true });
  const [wallet, payouts, movements] = await Promise.all([
    getArtistWallet(db, artist.id),
    db.payoutRequest.findMany({ where: { artistId: artist.id }, orderBy: { requestedAt: "desc" }, take: 20 }),
    db.ledgerLine.findMany({
      where: { account: { code: artistAvailable(artist.id).code } },
      include: { entry: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const acc = artist.payoutAccount;
  const [min, firstPayout] = await Promise.all([
    payoutMinCents(db, artist.id),
    db.payoutRequest.count({ where: { artistId: artist.id, status: { in: ["PROCESSING", "PAID"] } } }).then((n) => n === 0),
  ]);

  return (
    <div className="container-app max-w-2xl">
      <h1 className="text-2xl font-bold">Carteira</h1>

      <section className="card mt-4">
        <p className="text-sm text-muted">Saldo disponível</p>
        <LiveWallet initialCents={wallet.availableCents} />
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted">Saldo pendente</dt><dd className="font-semibold">{formatKz(wallet.pendingCents)}</dd></div>
          <div><dt className="text-muted">Em levantamento</dt><dd className="font-semibold">{formatKz(wallet.processingCents)}</dd></div>
          <div><dt className="text-muted">Ganho este mês</dt><dd className="font-semibold">{formatKz(wallet.earnedThisMonthCents)}</dd></div>
          <div><dt className="text-muted">Total ganho</dt><dd className="font-semibold">{formatKz(wallet.earnedTotalCents)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">Disponível = dinheiro já recebido pela plataforma, que podes levantar. Pendente = só na fase de pagamentos automáticos, enquanto o prestador não liquida.</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Levantar</h2>
        {!acc ? (
          <p className="mt-2 text-sm text-muted">Primeiro liga a conta onde queres receber (em baixo).</p>
        ) : wallet.availableCents < min ? (
          <p className="mt-2 text-sm text-muted">{firstPayout ? "O teu primeiro levantamento pode ser a partir de" : "O levantamento mínimo é"} {formatKz(min)}. Faltam {formatKz(min - Math.max(0, wallet.availableCents))}.</p>
        ) : (
          <ActionForm action={requestPayoutAction} className="card mt-2 space-y-3" resetOnSuccess>
            <label className="label" htmlFor="amount">Valor (Kz)</label>
            <input className="input" id="amount" name="amount" type="number" inputMode="numeric" min={Math.ceil(min / 100)} max={Math.floor(wallet.availableCents / 100)} defaultValue={Math.floor(wallet.availableCents / 100)} required />
            <p className="hint">Para: {acc.method === "BANK_IBAN" ? `${acc.bankName} · ${formatIban(acc.iban ?? "")}` : `Multicaixa Express ${formatPhone(acc.mcxPhone ?? "")}`}</p>
            <SubmitButton>Levantar</SubmitButton>
            <p className="text-center text-xs text-muted">Tentamos pagar em 24 horas{firstPayout ? " (no 1.º levantamento confirmamos primeiro o teu BI e a conta)" : ""}.</p>
          </ActionForm>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Conta para receber</h2>
        <PayoutAccountForm
          fullName={artist.fullName}
          current={acc ? { method: acc.method, holderName: acc.holderName, bankName: acc.bankName ?? "", iban: acc.iban ? formatIban(acc.iban) : "", mcxPhone: acc.mcxPhone ? formatPhone(acc.mcxPhone) : "" } : null}
        />
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Levantamentos</h2>
        {payouts.length === 0 && <p className="mt-2 text-sm text-muted">Ainda não fizeste levantamentos.</p>}
        <ul className="mt-2 space-y-2">
          {payouts.map((p) => (
            <li key={p.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{formatKz(p.amountCents)}</p>
                <p className="text-xs text-muted">{formatDateTime(p.requestedAt)}{p.processedAt ? ` · tratado ${formatDateTime(p.processedAt)}` : ""}</p>
                {p.status === "REJECTED" && p.adminNote && <p className="text-xs text-danger">Motivo: {p.adminNote}</p>}
              </div>
              <PayoutStatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Movimentos</h2>
          <Link href="/extrato" className="btn-secondary btn-sm no-underline">Extrato mensal (PDF/CSV)</Link>
        </div>
        <ul className="mt-2 divide-y divide-white/5 rounded-2xl bg-surface px-4">
          {movements.length === 0 && <li className="py-6 text-center text-sm text-muted">Ainda sem movimentos. Cada episódio desbloqueado e cada presente nas tuas séries aparecem aqui.</li>}
          {movements.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p>{KIND_LABEL[m.entry.kind] ?? m.entry.kind}</p>
                <p className="text-xs text-muted">{m.entry.description} · {formatDateTime(m.createdAt)}</p>
              </div>
              {/* Na carteira (passivo), crédito = entrada de dinheiro para o artista */}
              <span className={m.amountCents < 0 ? "font-semibold text-ok" : "font-semibold text-muted"}>
                {m.amountCents < 0 ? "+" : "−"}{formatKz(Math.abs(m.amountCents))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
