import Link from "next/link";
import type { Metadata } from "next";
import type { PayoutStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatIban } from "@/lib/iban";
import { formatPhone } from "@/lib/phone";
import { getObjectUrl } from "@/domain/storage";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Flash } from "@/components/Flash";
import { PayoutStatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { IconDownload } from "@/components/icons";
import { markPayoutPaidAction, rejectPayoutAction, verifyArtistAction } from "../actions";

export const metadata: Metadata = { title: "Levantamentos" };

const TABS: [PayoutStatus, string][] = [["PROCESSING", "Em processamento"], ["PAID", "Pagos"], ["REJECTED", "Rejeitados"]];

export default async function AdminPayouts({ searchParams }: { searchParams: Promise<{ estado?: string; feito?: string }> }) {
  const { estado, feito } = await searchParams;
  const status = (TABS.find(([s]) => s === estado)?.[0] ?? "PROCESSING") as PayoutStatus;
  const items = await db.payoutRequest.findMany({
    where: { status },
    orderBy: { requestedAt: status === "PROCESSING" ? "asc" : "desc" },
    take: 100,
    include: { artist: { select: { id: true, stageName: true, fullName: true, biNumber: true, verifiedAt: true } }, processedBy: { select: { name: true } } },
  });
  const proofUrls = await Promise.all(items.map((p) => (p.proofKey ? getObjectUrl("private", p.proofKey, 900) : null)));
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div>
      <Flash code={feito} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Levantamentos</h1>
        <form action="/admin/levantamentos/csv" className="flex items-center gap-2">
          <label htmlFor="mes" className="sr-only">Mês</label>
          <input id="mes" name="mes" type="month" defaultValue={thisMonth} className="input w-auto" />
          <button className="btn-secondary"><IconDownload size={18} /> Exportar CSV</button>
        </form>
      </div>
      <p className="mt-1 text-sm text-muted">Faz a transferência no teu banco/Multicaixa Express e depois marca "Pago" com o comprovativo.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([s, label]) => (
          <Link key={s} href={`/admin/levantamentos?estado=${s}`} className={s === status ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{label}</Link>
        ))}
      </div>
      {items.length === 0 && <p className="mt-6 text-muted">Nada por aqui.</p>}
      <ul className="mt-4 space-y-4">
        {items.map((p, i) => {
          const dest = p.method === "BANK_IBAN" ? formatIban(p.iban ?? "") : formatPhone(p.mcxPhone ?? "");
          return (
            <li key={p.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-2xl font-bold text-accent">{formatKz(p.amountCents)}</p>
                <PayoutStatusBadge status={p.status} />
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Artista</dt><dd>{p.artist.stageName} ({p.artist.fullName})</dd>
                <dt className="text-muted">Titular</dt><dd>{p.holderName}</dd>
                <dt className="text-muted">{p.method === "BANK_IBAN" ? `IBAN · ${p.bankName}` : "Multicaixa Express"}</dt>
                <dd className="flex items-center gap-1 font-mono">{dest}<CopyButton text={dest.replace(/\s/g, "")} label="Copiar destino" /></dd>
                <dt className="text-muted">Pedido</dt><dd>{formatDateTime(p.requestedAt)}</dd>
                {p.processedBy && <><dt className="text-muted">Tratado por</dt><dd>{p.processedBy.name} · {p.processedAt && formatDateTime(p.processedAt)}</dd></>}
                {p.adminNote && <><dt className="text-muted">Nota</dt><dd>{p.adminNote}</dd></>}
              </dl>
              {proofUrls[i] && <a href={proofUrls[i]!} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-accent2 underline">Ver comprovativo de pagamento</a>}
              {p.status === "PROCESSING" && !p.artist.verifiedAt && (
                <ActionForm action={verifyArtistAction} className="mt-4 rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm">
                  <input type="hidden" name="artistId" value={p.artist.id} />
                  <p className="font-semibold text-warn">Primeiro levantamento: verifica o artista</p>
                  <p className="mt-1 text-muted">Confirma o BI <strong className="font-mono text-fg">{p.artist.biNumber}</strong> (pede uma foto ao artista) e que o titular <strong className="text-fg">{p.holderName}</strong> é o mesmo nome do registo: <strong className="text-fg">{p.artist.fullName}</strong>.</p>
                  <label className="mt-2 flex items-center gap-2"><input type="checkbox" name="confirm" className="checkbox mt-0" required /> Verifiquei o BI e a conta para receber</label>
                  <SubmitButton className="btn-secondary btn-sm mt-2">Marcar artista como verificado</SubmitButton>
                </ActionForm>
              )}
              {p.status === "PROCESSING" && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ActionForm action={markPayoutPaidAction} className="space-y-2">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="label" htmlFor={`proof-${p.id}`}>Comprovativo da transferência</label>
                    <input id={`proof-${p.id}`} name="proof" type="file" accept="image/*,application/pdf" className="input" required />
                    <input name="note" className="input" placeholder="Nota (opcional)" />
                    <SubmitButton className="btn-primary w-full" pendingText="A guardar…">Marcar como pago</SubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectPayoutAction} className="space-y-2">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="label" htmlFor={`reason-${p.id}`}>Rejeitar (o valor volta à carteira)</label>
                    <input id={`reason-${p.id}`} name="reason" className="input" placeholder="Motivo" required minLength={3} />
                    <SubmitButton className="btn-danger w-full" pendingText="…">Rejeitar</SubmitButton>
                  </ActionForm>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
