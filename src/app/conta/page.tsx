import Link from "next/link";
import type { Metadata } from "next";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { coinsLabel, formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { pointsBalance } from "@/domain/points";
import { coinBalance } from "@/domain/coins/service";
import { inviteSummary } from "@/domain/fans/invites";
import { superfanOf } from "@/domain/artists/growth";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { IconBell, IconBookmark, IconChevronRight, IconCoin, IconLogout, IconPlay, IconShield, IconStar, IconWallet } from "@/components/icons";

export const metadata: Metadata = { title: "A minha conta" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const user = await requireUser("/conta");
  const { pedido } = await searchParams;
  const [inv, superfan] = await Promise.all([inviteSummary(db, user.id), superfanOf(db, user.id)]);
  const [coins, points, favCount, unread, pass, payments, unlocked] = await Promise.all([
    coinBalance(db, user.id),
    pointsBalance(db, user.id),
    db.favorite.count({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.weeklyPass.findFirst({ where: { userId: user.id, revokedAt: null, endsAt: { gt: new Date() } }, orderBy: { endsAt: "desc" } }),
    db.paymentRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.entitlement.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { episode: { include: { series: { select: { title: true } } } } },
    }),
  ]);

  return (
    <div className="container-app max-w-2xl">
      {pedido === "enviado" && (
        <p role="status" className="mb-4 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">Comprovativo enviado. Avisamos-te aqui quando for confirmado.</p>
      )}
      <h1 className="text-2xl font-bold">Olá, {user.name.split(" ")[0]}</h1>
      <p className="text-sm text-muted">{formatPhone(user.phone)}</p>

      {(user.role === "ARTIST" || user.role === "ADMIN") && (
        <Link href={user.role === "ADMIN" ? "/admin" : "/artista"} className="card mt-4 flex items-center justify-between no-underline hover:bg-surface2">
          <span className="flex items-center gap-2 font-semibold text-fg">{user.role === "ADMIN" ? <IconShield size={20} /> : <IconWallet size={20} />} {user.role === "ADMIN" ? "Painel de administração" : "Painel do artista"}</span>
          <IconChevronRight size={18} className="text-muted" />
        </Link>
      )}

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/loja" className="rounded-2xl bg-gradient-to-br from-accent/25 to-surface p-4 no-underline">
          <p className="flex items-center gap-1.5 text-xs text-muted"><IconCoin size={16} /> Moedas</p>
          <p className="font-display text-2xl font-bold text-accent2">{coins.toLocaleString("pt-AO")}</p>
          <p className="text-xs font-semibold text-accent">Comprar moedas →</p>
        </Link>
        <div className="rounded-2xl bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted"><IconStar size={16} /> Pontos de fã</p>
          <p className="font-display text-2xl font-bold">{points}</p>
          <p className="text-xs text-muted">{business.points.costPerEpisode} = 1 episódio grátis</p>
        </div>
        <Link href="/lista" className="rounded-2xl bg-surface p-4 no-underline hover:bg-surface2">
          <p className="flex items-center gap-1.5 text-xs text-muted"><IconBookmark size={16} /> A minha lista</p>
          <p className="font-display text-2xl font-bold text-fg">{favCount}</p>
          <p className="text-xs text-muted">{favCount === 1 ? "série guardada" : "séries guardadas"}</p>
        </Link>
        <Link href="/conta/notificacoes" className="rounded-2xl bg-surface p-4 no-underline hover:bg-surface2">
          <p className="flex items-center gap-1.5 text-xs text-muted"><IconBell size={16} /> Notificações</p>
          <p className="font-display text-2xl font-bold text-fg">{unread}</p>
          <p className="text-xs text-muted">por ler</p>
        </Link>
      </section>
      {pass && <p className="mt-3 rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">Tens um passe semanal ativo até {formatDateTime(pass.endsAt)}.</p>}
      {(inv.ambassador || superfan.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {inv.ambassador && <span className="badge-free">🏅 Embaixador</span>}
          {superfan.map((f) => <Link key={f.artistId} href={`/${f.slug}`} className="badge-price no-underline">⭐ Superfã de {f.stageName}</Link>)}
        </div>
      )}
      <Link href="/convidar" className="card mt-3 flex items-center justify-between no-underline hover:bg-surface2">
        <span><strong className="text-fg">Convidar amigos</strong><span className="block text-xs text-muted">Ganhem pontos os dois · {inv.valid}/{inv.ambassadorTarget} para Embaixador</span></span>
        <IconChevronRight size={18} className="text-muted" />
      </Link>
      <p className="mt-3 text-xs text-muted">Ganhas +{business.points.perCompletedEpisode} pontos por cada episódio que vês até ao fim. Também ganhas pontos por abrir a app todos os dias e por convidar amigos. Os pontos não valem dinheiro (100 pontos = 1 episódio).</p>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Episódios desbloqueados</h2>
        {unlocked.length === 0 ? (
          <EmptyState icon={<IconPlay size={24} />} title="Ainda não desbloqueaste episódios" text="Os primeiros episódios de cada série são grátis. Quando quiseres continuar, desbloqueia com moedas." action={{ href: "/", label: "Descobrir séries em alta" }} />
        ) : (
          <ul className="mt-2 space-y-2">
            {unlocked.map((u) => (
              <li key={u.id}>
                <Link href={`/ver/${u.episodeId}`} className="card flex items-center justify-between no-underline hover:bg-surface2">
                  <span className="text-fg">{u.episode.series.title} — Ep. {u.episode.number}{u.source === "POINTS" ? " · com pontos" : ""}</span>
                  <IconPlay size={18} className="text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Compras</h2>
        {payments.length === 0 ? (
          <EmptyState icon={<IconCoin size={24} />} title="Ainda não fizeste compras" text="Compra um pacote de moedas na Loja e desbloqueia os episódios que quiseres." action={{ href: "/loja", label: "Ir à Loja" }} />
        ) : (
          <ul className="mt-2 space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.kind === "COINS" ? coinsLabel(p.coins ?? 0) : p.kind === "WEEKLY_PASS" ? "Passe semanal" : p.kind === "GIFT" ? "Presente" : "Episódio"}</p>
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

      <section className="mt-8 flex flex-wrap gap-2">
        {user.role === "PUBLIC" && <Link href="/artista/registar" className="btn-secondary no-underline">Fazes séries? Torna-te artista</Link>}
        <form action="/sair" method="post">
          <button className="btn-ghost text-muted"><IconLogout size={18} /> Sair</button>
        </form>
      </section>
    </div>
  );
}
