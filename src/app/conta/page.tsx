import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { IconLogout, IconPlay } from "@/components/icons";

export const metadata: Metadata = { title: "A minha conta" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const user = await requireUser("/conta");
  const { pedido } = await searchParams;
  const [payments, unlocked] = await Promise.all([
    db.paymentRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { episode: { include: { series: { select: { title: true } } } } },
    }),
    db.entitlement.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { episode: { include: { series: { select: { title: true } } } } },
    }),
  ]);

  return (
    <div className="container-app max-w-2xl">
      {pedido === "enviado" && (
        <p role="status" className="mb-4 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">
          Comprovativo enviado. O teu pedido está a aguardar confirmação — avisamos-te aqui quando estiver desbloqueado.
        </p>
      )}
      <h1 className="text-2xl font-bold">Olá, {user.name.split(" ")[0]}</h1>
      <p className="text-sm text-muted">{formatPhone(user.phone)}</p>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Pedidos de pagamento</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Ainda não tens pedidos.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.episode ? `${p.episode.series.title} — Ep. ${p.episode.number}` : p.kind}</p>
                    <p className="text-xs text-muted">{formatDateTime(p.createdAt)} · {formatKz(p.amountCents)}</p>
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </div>
                {p.rejectionReason && <p className="mt-2 text-sm text-danger">Motivo: {p.rejectionReason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Episódios desbloqueados</h2>
        {unlocked.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Ainda não desbloqueaste episódios.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {unlocked.map((u) => (
              <li key={u.id}>
                <Link href={`/ver/${u.episodeId}`} className="card flex items-center justify-between no-underline hover:bg-surface2">
                  <span>{u.episode.series.title} — Ep. {u.episode.number}</span>
                  <IconPlay size={18} className="text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 flex flex-wrap gap-2">
        <Link href="/conta/notificacoes" className="btn-secondary">Notificações</Link>
        {user.role === "PUBLIC" && <Link href="/artista/registar" className="btn-secondary">Tornar-me artista</Link>}
        <form action="/sair" method="post">
          <button className="btn-ghost text-muted"><IconLogout size={18} /> Sair</button>
        </form>
      </section>
    </div>
  );
}
