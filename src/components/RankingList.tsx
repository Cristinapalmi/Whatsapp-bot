import Link from "next/link";
import { formatKz } from "@/lib/money";
import type { RankingRow } from "@/domain/ranking";

export function RankingList({ rows, by }: { rows: RankingRow[]; by: "views" | "revenue" }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Ainda sem dados este mês.</p>;
  return (
    <ol className="divide-y divide-white/5 rounded-2xl bg-surface">
      {rows.map((r, i) => (
        <li key={r.artistId}>
          <Link href={`/${r.slug}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 no-underline hover:bg-surface2">
            <span className={`w-8 text-center font-display text-xl font-bold ${i < 3 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
            <span className="flex-1 font-semibold text-fg">{r.stageName}</span>
            <span className="text-sm text-muted">
              {by === "views" ? `${r.views.toLocaleString("pt-AO")} visualizações` : formatKz(r.earnedCents)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
