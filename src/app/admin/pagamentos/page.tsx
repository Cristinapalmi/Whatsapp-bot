import Link from "next/link";
import type { Metadata } from "next";
import type { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { getObjectUrl } from "@/domain/storage";
import { checkUncheckedProofs } from "@/domain/payments/proof-check";
import { siteUrl } from "@config/brand";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Flash } from "@/components/Flash";
import { business } from "@config/business";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { confirmPaymentAction, reversePaymentAction, unblockPaymentsAction } from "../actions";
import { RejectForm } from "./RejectForm";

export const metadata: Metadata = { title: "Pagamentos" };

const TABS: [PaymentStatus, string][] = [["PENDING", "A aguardar"], ["CONFIRMED", "Confirmados"], ["REJECTED", "Rejeitados"], ["REVERSED", "Anulados"]];

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ estado?: string; feito?: string }> }) {
  const { estado, feito } = await searchParams;
  const status = (TABS.find(([s]) => s === estado)?.[0] ?? "PENDING") as PaymentStatus;
  if (status === "PENDING")
    await checkUncheckedProofs(db, async (k) => {
      const u = await getObjectUrl("private", k, 300);
      return u.startsWith("/") ? `${siteUrl()}${u}` : u;
    });
  const items = await db.paymentRequest.findMany({
    where: { status },
    // Suspeitos primeiro
    orderBy: status === "PENDING" ? [{ suspicious: "desc" }, { createdAt: "asc" }] : [{ createdAt: "desc" }],
    take: 50,
    include: {
      user: { select: { name: true, phone: true, paymentsBlockedAt: true } },
      reviewedBy: { select: { name: true } },
      episode: { include: { series: { select: { title: true } } } },
      artist: { select: { stageName: true } },
    },
  });

  const extras = await Promise.all(
    items.map(async (p) => ({
      proofUrl: p.proofKey ? await getObjectUrl("private", p.proofKey, 900) : null,
      // Aviso: outros pedidos do mesmo número de pagador nas últimas 24 h
      similar:
        status === "PENDING" && p.payerPhone
          ? await db.paymentRequest.count({ where: { payerPhone: p.payerPhone, id: { not: p.id }, createdAt: { gte: new Date(p.createdAt.getTime() - 86400000) } } })
          : 0,
    })),
  );

  return (
    <div>
      <Flash code={feito} />
      <h1 className="text-2xl font-bold">Pagamentos manuais</h1>
      <p className="mt-2 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn"><strong>Confirma sempre no teu Multicaixa Express/banco: valor, hora e n.º de operação.</strong> A app só marca “🚩 Suspeito” para ajudar — nunca confirma nem recusa sozinha.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([s, label]) => (
          <Link key={s} href={`/admin/pagamentos?estado=${s}`} className={s === status ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{label}</Link>
        ))}
      </div>
      {items.length === 0 && <p className="mt-6 text-muted">Nada por aqui.</p>}
      <ul className="mt-4 space-y-4">
        {items.map((p, i) => {
          const { proofUrl, similar } = extras[i];
          const isPdf = p.proofKey?.endsWith(".pdf");
          return (
            <li key={p.id} className={`card grid gap-4 md:grid-cols-[220px_1fr] ${p.suspicious ? "ring-2 ring-danger/70" : ""}`}>
              <div>
                {proofUrl && !isPdf && (
                  <a href={proofUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={proofUrl} alt="Comprovativo" className="max-h-72 w-full rounded-xl bg-surface2 object-contain" />
                  </a>
                )}
                {proofUrl && isPdf && <a href={proofUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full">Abrir comprovativo (PDF)</a>}
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-2xl font-bold text-accent">{formatKz(p.amountCents)}</p>
                  <PaymentStatusBadge status={p.status} />
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Fã</dt><dd>{p.user.name} · {formatPhone(p.user.phone)}</dd>
                  <dt className="text-muted">Compra</dt><dd>{p.kind === "COINS" ? <strong className="text-accent2">{p.coins} moedas</strong> : p.kind === "EPISODE" && p.episode ? `${p.episode.series.title} — Ep. ${p.episode.number} (Kz, antigo)` : p.kind === "WEEKLY_PASS" ? "Passe semanal" : `Presente: ${business.gifts.find((g) => g.id === p.giftType)?.label ?? p.giftType} (Kz, antigo)`}</dd>
                  <dt className="text-muted">Artista</dt><dd>{p.artist?.stageName ?? (p.kind === "WEEKLY_PASS" ? "Fundo do passe (dividido no fecho semanal)" : p.kind === "COINS" ? "— (os artistas ganham quando o fã gastar as moedas)" : "—")}</dd>
                  <dt className="text-muted">Método</dt><dd>{p.method === "MULTICAIXA_EXPRESS" ? "Multicaixa Express" : "Transferência bancária"}</dd>
                  <dt className="text-muted">Pagou de</dt><dd>{p.payerPhone ? formatPhone(p.payerPhone) : "—"}</dd>
                  <dt className="text-muted">N.º operação</dt><dd className="font-mono">{p.transactionRef}</dd>
                  <dt className="text-muted">Enviado</dt><dd>{formatDateTime(p.createdAt)}</dd>
                  {p.reviewedBy && <><dt className="text-muted">Tratado por</dt><dd>{p.reviewedBy.name} · {p.reviewedAt && formatDateTime(p.reviewedAt)}</dd></>}
                  {p.rejectionReason && <><dt className="text-muted">Motivo</dt><dd className="text-danger">{p.rejectionReason}</dd></>}
                </dl>
                {p.user.paymentsBlockedAt && (
                  <ActionForm action={unblockPaymentsAction} className="mt-2 flex items-center gap-2 text-xs text-danger">
                    <span>⛔ Esta pessoa está bloqueada (não pode enviar comprovativos).</span>
                    <input type="hidden" name="userId" value={p.userId} />
                    <SubmitButton className="btn-secondary btn-sm">Desbloquear</SubmitButton>
                  </ActionForm>
                )}
                {p.suspicious && (
                  <div className="mt-2 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
                    <p className="font-bold">🚩 Suspeito</p>
                    <ul className="mt-1 list-disc pl-5 text-xs">{p.suspicionReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  </div>
                )}
                {p.status === "PENDING" && !p.proofCheckedAt && <p className="mt-2 text-xs text-muted">A verificar o comprovativo…</p>}
                {p.ocrText && (
                  <details className="mt-2 text-xs text-muted">
                    <summary className="cursor-pointer">Texto lido no comprovativo</summary>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-surface2 p-2 font-mono">{p.ocrText}</pre>
                  </details>
                )}
                {similar > 0 && <p className="mt-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">Atenção: há mais {similar} pedido(s) do mesmo número nas últimas 24 h. Confirma que cada transferência é diferente.</p>}

                {p.status === "PENDING" && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ActionForm action={confirmPaymentAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton className="btn-primary w-full" pendingText="A confirmar…">Confirmar</SubmitButton>
                    </ActionForm>
                    <RejectForm id={p.id} />
                  </div>
                )}
                {p.status === "CONFIRMED" && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-muted">Anular este pagamento (transferência falsa / reembolso)</summary>
                    <ActionForm action={reversePaymentAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="reason" className="input" placeholder="Motivo" required minLength={3} />
                      <SubmitButton className="btn-danger" pendingText="…">Anular</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
