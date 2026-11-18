import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { CATEGORY_LABELS } from "@/lib/categories";
import { IconChevronRight } from "@/components/icons";

export const metadata: Metadata = { title: "Séries" };

const LABEL: Record<string, [string, string]> = {
  IN_REVIEW: ["Em análise", "badge-pending"], APPROVED: ["Aprovada", "badge-unlocked"], PUBLISHED: ["Publicada", "badge-free"],
  REJECTED: ["Rejeitada", "badge-danger"], HIDDEN: ["Retirada", "badge-muted"],
};

export default async function AdminSeries() {
  const series = await db.series.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { artist: { select: { stageName: true } }, _count: { select: { episodes: true } } },
  });
  return (
    <div>
      <h1 className="text-2xl font-bold">Séries</h1>
      <p className="mt-1 text-sm text-muted">Os artistas enviam as séries; aqui defines episódios grátis, gancho, preço, carregas os vídeos e publicas.</p>
      <ul className="mt-4 space-y-2">
        {series.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/series/${s.id}`} className="card flex items-center justify-between gap-3 no-underline hover:bg-surface2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{s.title}</p>
                <p className="text-xs text-muted">{s.artist.stageName} · {CATEGORY_LABELS[s.category]} · {s._count.episodes}/{s.plannedEpisodes} ep. · {s.freeEpisodes} grátis · {s.priceCoins ? `${s.priceCoins} moedas` : "preço por defeito"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={LABEL[s.status][1]}>{LABEL[s.status][0]}</span>
                <IconChevronRight size={18} className="text-muted" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
