import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { artistsEarningsSummary } from "@/domain/reports";
import { monthRange } from "@/domain/ranking";
import { IconDownload } from "@/components/icons";

export const metadata: Metadata = { title: "Exportações" };

const EXPORTS: [string, string, string][] = [
  ["pagamentos", "Pagamentos do público", "Todos os pedidos do mês, com a divisão artista/plataforma, quem confirmou e quando."],
  ["ganhos-artistas", "Ganhos por artista", "Para cada artista: saldo no início, episódios, presentes, passe, anulações, levantamentos e saldo no fim."],
  ["livro-razao", "Livro-razão", "Todos os lançamentos (débito/crédito) — para o contabilista."],
  ["series", "Desempenho das séries", "Espectadores, minutos, vendas e conversão grátis → pago de cada série."],
];

export default async function AdminExports({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const range = monthRange(mes);
  const summary = await artistsEarningsSummary(db, range.key);
  return (
    <div>
      <h1 className="text-2xl font-bold">Exportações</h1>
      <form className="mt-3 flex items-center gap-2">
        <label htmlFor="mes" className="text-sm text-muted">Mês</label>
        <input id="mes" name="mes" type="month" defaultValue={range.key} className="input w-auto" />
        <button className="btn-secondary btn-sm">Ver</button>
      </form>
      <p className="mt-2 text-xs text-muted">Ficheiros CSV que abrem no Excel (separador ";" e vírgula nos decimais). Meses em hora de Luanda.</p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {EXPORTS.map(([tipo, title, desc]) => (
          <li key={tipo} className="card flex flex-col">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 flex-1 text-sm text-muted">{desc}</p>
            <a href={`/admin/exportacoes/${tipo}?mes=${range.key}`} className="btn-secondary btn-sm mt-3 no-underline"><IconDownload size={18} /> Descarregar CSV</a>
          </li>
        ))}
        <li className="card flex flex-col">
          <p className="font-semibold">Levantamentos</p>
          <p className="mt-1 flex-1 text-sm text-muted">Pedidos de levantamento do mês, com dados bancários e estado.</p>
          <a href={`/admin/levantamentos/csv?mes=${range.key}`} className="btn-secondary btn-sm mt-3 no-underline"><IconDownload size={18} /> Descarregar CSV</a>
        </li>
        <li className="card flex flex-col">
          <p className="font-semibold">Aceitações da Política do Artista</p>
          <p className="mt-1 flex-1 text-sm text-muted">Prova legal: cada caixa aceite, versão, data, hora e IP (todos os meses).</p>
          <a href="/admin/exportacoes/consentimentos" className="btn-secondary btn-sm mt-3 no-underline"><IconDownload size={18} /> Descarregar CSV</a>
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-bold">Extratos dos artistas — {range.key}</h2>
      {summary.length === 0 && <p className="mt-2 text-sm text-muted">Sem movimentos neste mês.</p>}
      <div className="mt-2 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Artista</th><th>Ganhou</th><th>Levantamentos pagos</th><th>Saldo no fim</th><th></th></tr></thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.artist.id}>
                <td>{s.artist.stageName}</td>
                <td>{formatKz(s.earnedCents)}</td>
                <td>{formatKz(s.payoutsPaid.cents)}</td>
                <td>{formatKz(s.closingCents)}</td>
                <td><Link href={`/extrato?artista=${s.artist.id}&mes=${range.key}`} className="text-accent2 underline">Extrato</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
