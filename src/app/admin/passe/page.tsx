import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { balance } from "@/domain/money/ledger";
import { passPool } from "@/domain/money/accounts";
import { weekKey, weekRange } from "@/domain/money/weeks";
import { isWeekClosed } from "@/domain/payments/pass";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { closeWeeksAction } from "../actions";

export const metadata: Metadata = { title: "Passe semanal" };

export default async function AdminPass() {
  const now = new Date();
  const current = weekKey(now);
  const pools = await db.ledgerAccount.findMany({ where: { code: { startsWith: "pass-pool:" } }, select: { code: true } });
  const weeks = [...new Set([current, ...pools.map((p) => p.code.slice("pass-pool:".length))])].sort().reverse();
  const rows = await Promise.all(
    weeks.map(async (w) => {
      const closeEntry = await db.journalEntry.findUnique({ where: { idempotencyKey: `pass-close:${w}` }, include: { lines: { include: { account: true } } } });
      return {
        week: w,
        range: weekRange(w),
        pool: await balance(db, passPool(w)),
        closed: await isWeekClosed(db, w),
        closedAt: closeEntry?.createdAt ?? null,
        distributed: closeEntry ? -closeEntry.lines.filter((l) => l.account.code.startsWith("artist:")).reduce((a, l) => a + l.amountCents, 0) : 0,
      };
    }),
  );
  const activePasses = await db.weeklyPass.count({ where: { revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } } });

  return (
    <div>
      <h1 className="text-2xl font-bold">Passe semanal</h1>
      <p className="mt-1 text-sm text-muted">
        Metade de cada passe vai para o fundo da semana em que foi confirmado. À segunda-feira (01:30, hora de Luanda) o fundo é dividido automaticamente pelos artistas conforme o tempo visto com passe. Se ninguém viu, passa para a semana seguinte.
      </p>
      <p className="mt-2 text-sm">Passes ativos agora: <strong>{activePasses}</strong></p>
      <ActionForm action={closeWeeksAction} className="mt-4">
        <SubmitButton className="btn-secondary">Fechar já as semanas terminadas</SubmitButton>
      </ActionForm>
      <table className="table mt-6">
        <thead><tr><th>Semana</th><th>Período</th><th>Fundo atual</th><th>Estado</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.week}>
              <td className="font-mono">{r.week}{r.week === current ? " (atual)" : ""}</td>
              <td className="text-muted">{formatDateTime(r.range.start)} – {formatDateTime(new Date(r.range.end.getTime() - 60000))}</td>
              <td>{formatKz(r.pool)}</td>
              <td>{r.closed ? <span className="badge-free">Fechada · {formatKz(r.distributed)} aos artistas</span> : <span className="badge-pending">Aberta</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
