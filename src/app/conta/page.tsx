import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { IconLogout, IconPlay, IconStar } from "@/components/icons";
import { pointsBalance } from "@/domain/points";
import { business } from "@config/business";

export const metadata: Metadata = { title: "A minha conta" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const user = await requireUser("/conta");
  const { pedido } = await searchParams;
  const [points, pass, payments, unlocked] = await Promise.all([
    pointsBalance(db, user.id),
    db.weeklyPass.findFirst({ where: { userId: user.id, revokedAt: null, endsAt: { gt: new Date() } }, orderBy: { endsAt: "desc" } }),
    db.paymentRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { episode: { include: { series: { select: { title: true } } } }, artist: { select: { stageName: true } } },
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

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="card">
          <p className="text-sm text-muted">Passe semanal</p>
          {pass ? (
            <p className="mt-1 font-semibold text-ok">Ativo até {formatDateTime(pass.endsAt)}</p>
          ) : (
            <>
              <p className="mt-1 font-semibold">Sem passe ativo</p>
              <Link href="/loja" className="btn-primary btn-sm mt-3">Comprar moedas</Link>
            </>
          )}
        </div>
        <div className="card">
          <p className="flex items-center gap-2 text-sm text-muted"><IconStar size={16} /> Pontos de fã</p>
          <p className="font-display text-3xl font-bold text-accent2">{points}</p>
          <p className="text-xs text-muted">+{business.points.perCompletedEpisode} por episódio visto até ao fim · {business.points.costPerEpisode} pontos = 1 episódio grátis. Os pontos não valem dinheiro.</p>
        </div>
      </section>

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
                    <p className="font-semibold">{p.kind === "EPISODE" && p.episode ? `${p.episode.series.title} — Ep. ${p.episode.number}` : p.kind === "WEEKLY_PASS" ? "Passe semanal" : `Presente ${business.gifts.find((g) => g.id === p.giftType)?.label ?? ""} para ${p.artist?.stageName ?? ""}`}</p>
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
                  <span>{u.episode.series.title} — Ep. {u.episode.number}{u.source === "POINTS" ? " (com pontos)" : ""}</span>
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
