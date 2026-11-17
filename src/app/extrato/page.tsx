import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { resolveStatementArtist } from "@/lib/statement-access";
import { STATEMENT_LABELS, artistStatement } from "@/domain/reports";
import { monthRange } from "@/domain/ranking";
import { PrintButton } from "@/components/PrintButton";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { title: "Extrato mensal" };
export const dynamic = "force-dynamic";

export default async function StatementPage({ searchParams }: { searchParams: Promise<{ mes?: string; artista?: string }> }) {
  const { mes, artista } = await searchParams;
  const artist = await resolveStatementArtist(artista);
  if (!artist) redirect("/entrar?next=/extrato");
  const range = monthRange(mes);
  const st = await artistStatement(db, artist.id, range.key);
  const label = new Intl.DateTimeFormat("pt-AO", { month: "long", year: "numeric", timeZone: "UTC" }).format(range.fromDay).replace(/^./, (c) => c.toUpperCase());
  const qs = `mes=${range.key}${artista ? `&artista=${artist.id}` : ""}`;

  return (
    <div className="container-app max-w-3xl print:max-w-none print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <form className="flex items-center gap-2">
          {artista && <input type="hidden" name="artista" value={artist.id} />}
          <label htmlFor="mes" className="text-sm text-muted">Mês</label>
          <input id="mes" name="mes" type="month" defaultValue={range.key} className="input w-auto" />
          <button className="btn-secondary btn-sm">Ver</button>
        </form>
        <div className="flex gap-2">
          <a href={`/extrato/csv?${qs}`} className="btn-secondary btn-sm no-underline"><IconDownload size={18} /> CSV</a>
          <PrintButton />
        </div>
      </div>

      <header className="mt-6">
        <p className="font-display text-xl font-extrabold text-accent print:text-black">{brand.name}</p>
        <h1 className="text-2xl font-bold">Extrato mensal — {label}</h1>
        <p className="text-muted print:text-black">{artist.stageName} · {artist.fullName} · BI {artist.biNumber}</p>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="Saldo no início" value={formatKz(st.openingCents)} />
        <Box label="Ganhou no mês" value={formatKz(st.earnedCents)} />
        <Box label="Levantamentos pagos" value={formatKz(st.payoutsPaid.cents)} />
        <Box label="Saldo no fim" value={formatKz(st.closingCents)} />
      </section>

      <section className="card mt-4 print:border print:border-black/20 print:bg-white">
        <h2 className="font-bold">Resumo</h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          {(["EPISODE", "GIFT", "PASS", "REVERSAL", "PAYOUT_REQUEST", "PAYOUT_RETURNED"] as const).map((k) => (
            <div key={k} className="contents">
              <dt className="text-muted print:text-black">{STATEMENT_LABELS[k]}</dt>
              <dd className="text-right font-semibold">{formatKz(st.totals[k])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4">
        <h2 className="font-bold">Movimentos</h2>
        {st.movements.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sem movimentos neste mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table mt-2">
              <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className="text-right">Valor</th></tr></thead>
              <tbody>
                {st.movements.map((m, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{formatDateTime(m.date)}</td>
                    <td>{STATEMENT_LABELS[m.type]}</td>
                    <td>{m.description}</td>
                    <td className={`text-right font-semibold ${m.amountCents >= 0 ? "text-ok print:text-black" : ""}`}>{m.amountCents >= 0 ? "+" : "−"}{formatKz(Math.abs(m.amountCents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="mt-6 text-xs text-muted print:text-black">
        Valores em Kwanzas. "Ganhou no mês" = a parte do artista ({business.artistSharePercent}%) do que o público pagou, depois de eventuais comissões. Documento gerado a {formatDateTime(new Date())}.
      </p>
      <p className="mt-4 print:hidden"><Link href="/artista/carteira" className="text-sm text-accent2 underline">Voltar à carteira</Link></p>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="card print:border print:border-black/20 print:bg-white">
      <p className="text-xs text-muted print:text-black">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}
