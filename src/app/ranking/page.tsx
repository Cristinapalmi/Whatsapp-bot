import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { monthRange, monthlyRanking, sortByRevenue, sortByViews } from "@/domain/ranking";
import { RankingList } from "@/components/RankingList";

export const metadata: Metadata = { title: "Disputa dos artistas" };
export const dynamic = "force-dynamic";

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ por?: string; mes?: string }> }) {
  const { por, mes } = await searchParams;
  const by = por === "receita" ? "revenue" : "views";
  const range = monthRange(mes);
  const rows = await monthlyRanking(db, range.key);
  const sorted = (by === "views" ? sortByViews(rows) : sortByRevenue(rows)).filter((r) => (by === "views" ? r.views > 0 : r.earnedCents > 0));
  const label = new Intl.DateTimeFormat("pt-AO", { month: "long", year: "numeric", timeZone: "UTC" }).format(range.fromDay).replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="container-app max-w-2xl">
      <h1 className="text-3xl font-bold">Disputa dos artistas</h1>
      <p className="mt-1 text-muted">{label}</p>
      <div className="mt-4 flex gap-2">
        <Link href={`/ranking?por=vistas&mes=${range.key}`} className={by === "views" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Mais vistos</Link>
        <Link href={`/ranking?por=receita&mes=${range.key}`} className={by === "revenue" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Mais apoiados</Link>
      </div>
      <div className="mt-4"><RankingList rows={sorted} by={by} /></div>
      <p className="mt-4 text-xs text-muted">O ranking recomeça no dia 1 de cada mês. "Mais apoiados" = o que o público pagou aos artistas (episódios, passe e presentes).</p>
    </div>
  );
}
