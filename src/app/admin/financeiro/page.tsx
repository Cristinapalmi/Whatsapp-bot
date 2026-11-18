import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { coinsLabel, formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { coinFinancialReport, periodRange } from "@/domain/reports";
import { balance } from "@/domain/money/ledger";
import { PLATFORM_REVENUE } from "@/domain/money/accounts";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { title: "Financeiro" };

export default async function AdminFinance({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const range = periodRange(sp.de, sp.ate);
  const [r, revenueTotal] = await Promise.all([coinFinancialReport(db, range.from, range.to), balance(db, PLATFORM_REVENUE)]);
  const qs = `de=${range.de}&ate=${range.ate}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <form className="flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="de">De</label><input className="input w-auto" id="de" name="de" type="date" defaultValue={range.de} /></div>
          <div><label className="label" htmlFor="ate">Até</label><input className="input w-auto" id="ate" name="ate" type="date" defaultValue={range.ate} /></div>
          <button className="btn-secondary">Ver</button>
          <a href={`/admin/exportacoes/financeiro?${qs}`} className="btn-secondary no-underline"><IconDownload size={18} /> CSV</a>
        </form>
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Moedas vendidas no período</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Compras confirmadas" value={String(r.sold.purchases)} sub={coinsLabel(r.sold.coins)} />
        <Kpi label="Valor pago pelos fãs" value={formatKz(r.sold.grossCents)} />
        <Kpi label="Comissões de pagamento" value={formatKz(r.sold.feesCents)} />
        <Kpi label="Valor líquido" value={formatKz(r.sold.netCents)} sub={r.sold.reversed ? `${r.sold.reversed} anulada(s)` : undefined} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Moedas gastas no período</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Moedas gastas" value={r.spent.coins.toLocaleString("pt-AO")} sub={`${r.spent.episodes} ${r.spent.episodes === 1 ? "episódio" : "episódios"} · ${r.spent.gifts} ${r.spent.gifts === 1 ? "presente" : "presentes"}`} />
        <Kpi label="Valor real gasto" value={formatKz(r.spent.valueCents)} />
        <Kpi label="Parte dos criadores" value={formatKz(r.spent.creatorsCents)} />
        <Kpi label="Parte da plataforma" value={formatKz(r.spent.platformCents)} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Anúncios no período</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Episódios desbloqueados com anúncio" value={String(r.ads.unlocks)} href="/admin/anuncios" />
        <Kpi label="Receita de anúncios registada" value={formatKz(r.ads.revenueCents)} sub={`${r.ads.revenueEntries} registo(s)`} />
        <Kpi label="Distribuído aos criadores" value={formatKz(r.ads.distributedToCreatorsCents)} />
        <Kpi label="Fundos de anúncios por dividir" value={formatKz(r.ads.poolsNowCents)} sub="agora" />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Agora</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Moedas por gastar" value={r.outstanding.coins.toLocaleString("pt-AO")} sub={`${formatKz(r.outstanding.valueCents)} (ainda não é receita)`} />
        <Kpi label="Devido aos criadores" value={formatKz(r.owedToCreatorsCents)} sub="saldos por levantar" />
        <Kpi label="Levantamentos por aprovar" value={String(r.pendingPayouts.count)} sub={formatKz(r.pendingPayouts.cents)} href="/admin/levantamentos" />
        <Kpi label="Receita da plataforma (total)" value={formatKz(revenueTotal)} />
      </div>
      {r.outstanding.valueCents !== r.outstanding.ledgerCents && (
        <p className="mt-2 rounded-xl bg-danger/15 px-4 py-3 text-sm text-danger">Atenção: o valor das moedas por gastar não bate com o livro-razão. Contacta o suporte técnico.</p>
      )}
      {r.pendingCoinPayments > 0 && (
        <p className="mt-3 text-sm"><Link href="/admin/pagamentos" className="text-accent2 underline">{r.pendingCoinPayments} compra(s) de moedas a aguardar confirmação</Link></p>
      )}

      <h2 className="mt-8 text-lg font-bold">Compras de moedas no período</h2>
      {r.purchases.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sem compras confirmadas neste período.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Data</th><th>Fã</th><th>Moedas</th><th>Pago</th><th>Comissão</th><th>Estado</th><th>Confirmado por</th></tr></thead>
            <tbody>
              {r.purchases.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{p.reviewedAt ? formatDateTime(p.reviewedAt) : ""}</td>
                  <td>{p.user.name}<br /><span className="text-xs text-muted">{formatPhone(p.user.phone)}</span></td>
                  <td>{p.coins}</td>
                  <td>{formatKz(p.amountCents)}</td>
                  <td>{formatKz(p.feeCents)}</td>
                  <td><PaymentStatusBadge status={p.status} /></td>
                  <td>{p.reviewedBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-xl font-bold sm:text-2xl">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </>
  );
  return href ? <Link href={href} className="card block no-underline hover:bg-surface2">{body}</Link> : <div className="card">{body}</div>;
}
