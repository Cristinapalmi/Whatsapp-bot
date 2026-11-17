import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { startOfMonthUtc } from "@/lib/dates";
import { balance } from "@/domain/money/ledger";
import { PLATFORM_CASH, PLATFORM_REVENUE } from "@/domain/money/accounts";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminHome() {
  const month = startOfMonthUtc();
  const [users, artists, published, views, watch, grossAll, grossMonth, revenue, cash, owedAgg, poolAgg, watchers, payers] = await Promise.all([
    db.user.count({ where: { role: "PUBLIC" } }),
    db.artistProfile.count({ where: { status: "APPROVED" } }),
    db.series.count({ where: { status: "PUBLISHED" } }),
    db.watchProgress.count(),
    db.watchLog.aggregate({ _sum: { seconds: true } }),
    db.paymentRequest.aggregate({ where: { status: "CONFIRMED" }, _sum: { amountCents: true }, _count: true }),
    db.paymentRequest.aggregate({ where: { status: "CONFIRMED", reviewedAt: { gte: month } }, _sum: { amountCents: true }, _count: true }),
    balance(db, PLATFORM_REVENUE),
    balance(db, PLATFORM_CASH),
    db.ledgerLine.aggregate({ where: { account: { code: { startsWith: "artist:" } } }, _sum: { amountCents: true } }),
    db.ledgerLine.aggregate({ where: { account: { code: { startsWith: "pass-pool:" } } }, _sum: { amountCents: true } }),
    db.watchProgress.findMany({ distinct: ["userId"], select: { userId: true } }),
    db.paymentRequest.findMany({ where: { status: "CONFIRMED" }, distinct: ["userId"], select: { userId: true } }),
  ]);
  const owed = -(owedAgg._sum.amountCents ?? 0);
  const pools = -(poolAgg._sum.amountCents ?? 0);
  const conversion = watchers.length ? (payers.length / watchers.length) * 100 : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold">Resumo</h1>
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Dinheiro</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Receita bruta (total)" value={formatKz(grossAll._sum.amountCents ?? 0)} sub={`${grossAll._count} pagamentos`} />
        <Kpi label="Receita bruta (este mês)" value={formatKz(grossMonth._sum.amountCents ?? 0)} sub={`${grossMonth._count} pagamentos`} />
        <Kpi label="Ganhos da plataforma" value={formatKz(revenue)} sub="a tua parte (50%)" />
        <Kpi label="Devido aos artistas" value={formatKz(owed)} sub="saldos por pagar" />
        <Kpi label="Fundos do passe" value={formatKz(pools)} sub="por distribuir aos artistas" />
        <Kpi label="Caixa (livro-razão)" value={formatKz(cash)} sub="deve bater com a tua conta" />
      </div>
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Público</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Utilizadores" value={users.toLocaleString("pt-AO")} />
        <Kpi label="Visualizações" value={views.toLocaleString("pt-AO")} />
        <Kpi label="Minutos vistos" value={Math.round((watch._sum.seconds ?? 0) / 60).toLocaleString("pt-AO")} />
        <Kpi label="Conversão grátis → pago" value={`${conversion.toFixed(1)}%`} sub={`${payers.length} de ${watchers.length} espectadores`} />
        <Kpi label="Artistas ativos" value={String(artists)} />
        <Kpi label="Séries publicadas" value={String(published)} />
      </div>
      <p className="mt-6 text-xs text-muted">Verificação: "Caixa" = Ganhos da plataforma + Devido aos artistas + Fundos do passe por distribuir.</p>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-xl font-bold sm:text-2xl">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
