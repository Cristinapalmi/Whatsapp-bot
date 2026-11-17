import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { resolveReportAction } from "../actions";

export const metadata: Metadata = { title: "Denúncias" };

export default async function AdminReports() {
  const reports = await db.report.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { series: { select: { id: true, title: true } }, reporter: { select: { name: true } } },
  });
  return (
    <div>
      <h1 className="text-2xl font-bold">Denúncias</h1>
      <p className="mt-1 text-sm text-muted">Para retirar uma série, abre-a e usa "Retirar" com o motivo.</p>
      {reports.length === 0 && <p className="mt-6 text-muted">Sem denúncias.</p>}
      <ul className="mt-4 space-y-3">
        {reports.map((r) => (
          <li key={r.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.reason}</p>
              <span className={r.status === "OPEN" ? "badge-pending" : "badge-muted"}>{r.status === "OPEN" ? "Aberta" : r.status === "RESOLVED" ? "Resolvida" : "Arquivada"}</span>
            </div>
            <p className="text-sm text-muted">
              {r.series && <Link href={`/admin/series/${r.series.id}`} className="text-accent2 underline">{r.series.title}</Link>} · por {r.reporter?.name ?? "anónimo"} · {formatDateTime(r.createdAt)}
            </p>
            {r.details && <p className="mt-2 text-sm">{r.details}</p>}
            {r.status === "OPEN" && (
              <div className="mt-3 flex gap-2">
                <ActionForm action={resolveReportAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="RESOLVED" /><SubmitButton className="btn-secondary btn-sm">Resolvida</SubmitButton></ActionForm>
                <ActionForm action={resolveReportAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="DISMISSED" /><SubmitButton className="btn-ghost btn-sm">Arquivar</SubmitButton></ActionForm>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
