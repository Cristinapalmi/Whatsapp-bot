import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { formatDateTime } from "@/lib/dates";
import { reviewQueue } from "@/domain/series-workflow";
import { EmptyState } from "@/components/EmptyState";
import { IconChevronRight, IconFilm } from "@/components/icons";

export const metadata: Metadata = { title: "Séries por rever" };

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<{ feito?: string }> }) {
  const { feito } = await searchParams;
  const queue = await reviewQueue(db);
  const covers = await Promise.all(queue.map((s) => mediaUrl(s.coverKey)));
  return (
    <div className="max-w-3xl">
      {feito === "aprovado" && <p role="status" className="mb-4 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">Aprovado e publicado. O artista foi avisado.</p>}
      {feito === "recusado" && <p role="status" className="mb-4 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">Recusado. O artista recebeu o motivo.</p>}
      <h1 className="text-2xl font-bold">Séries por rever</h1>
      <p className="mt-1 text-sm text-muted">Os artistas criam as séries e carregam os vídeos. Aqui só verificas e publicas (ou recusas com o motivo).</p>
      {queue.length === 0 ? (
        <EmptyState icon={<IconFilm size={24} />} title="Nada por rever" text="Quando um artista enviar uma série ou episódios novos, aparecem aqui." />
      ) : (
        <ul className="mt-4 space-y-2">
          {queue.map((s, i) => (
            <li key={s.id}>
              <Link href={`/admin/revisao/${s.id}`} className="card flex items-center gap-3 no-underline hover:bg-surface2">
                <div className="aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-lg bg-surface2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {covers[i] && <img src={covers[i]!} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">{s.title}</p>
                  <p className="text-xs text-muted">{s.artist.stageName} · {s.status === "IN_REVIEW" ? "série nova" : "episódios novos"} · {s.episodes.length} episódio(s) · {formatDateTime(s.createdAt)}</p>
                </div>
                <IconChevronRight size={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
