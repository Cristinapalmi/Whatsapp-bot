import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { CATEGORY_LABELS } from "@/lib/categories";
import { getObjectUrl } from "@/domain/storage";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { approveReviewAction, rejectReviewAction } from "../../actions";

export const metadata: Metadata = { title: "Rever série" };

export default async function ReviewSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.series.findUnique({
    where: { id },
    include: { artist: { include: { user: { select: { phone: true } } } }, episodes: { orderBy: { number: "asc" } } },
  });
  if (!s) notFound();
  const cover = await mediaUrl(s.coverKey);
  const toReview = s.episodes.filter((e) => e.status === "IN_REVIEW");
  const videos = await Promise.all(toReview.map((e) => (e.videoKey ? getObjectUrl("media", e.videoKey, 3600) : null)));
  const subs = await Promise.all(toReview.map((e) => (e.subtitlesKey ? getObjectUrl("media", e.subtitlesKey, 3600) : null)));
  const trailer = s.trailerKey ? await getObjectUrl("media", s.trailerKey, 3600) : null;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/revisao" className="text-sm text-muted">← Séries por rever</Link>
      <div className="mt-2 grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt="Capa" className="h-full w-full object-cover" /> : <p className="p-3 text-sm text-danger">Sem capa</p>}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{s.title}</h1>
          <p className="text-sm text-muted">{s.artist.stageName} ({s.artist.fullName} · {s.artist.user.phone}) · {CATEGORY_LABELS[s.category]} · {s.status === "IN_REVIEW" ? "série nova" : "episódios novos numa série publicada"}</p>
          <p className="mt-3 whitespace-pre-line">{s.synopsis || <span className="text-muted">Sem sinopse.</span>}</p>
          <p className="mt-2 text-xs text-muted">{s.freeEpisodes} episódios grátis · {s.episodes.length} episódios · <Link href={`/admin/series/${s.id}`} className="underline">ver série completa</Link></p>
        </div>
      </div>

      <h2 className="mt-6 text-lg font-bold">Episódios por rever ({toReview.length})</h2>
      <ul className="mt-2 space-y-3">
        {toReview.map((e, i) => (
          <li key={e.id} className="card">
            <p className="font-semibold">Episódio {e.number}: {e.title}{e.number <= s.freeEpisodes ? " · grátis" : ""}{e.endsWithHook ? " · termina em gancho" : ""}</p>
            {e.hookText && <p className="text-sm text-muted">Gancho: “{e.hookText}”</p>}
            {videos[i] ? (
              <video controls preload="none" className="mt-2 aspect-[9/16] max-h-[70vh] w-auto rounded-xl bg-black" src={videos[i]!}>
                {subs[i] && <track kind="subtitles" src={subs[i]!} srcLang="pt" label="Português" />}
              </video>
            ) : (
              <p className="mt-2 text-sm text-danger">Sem vídeo (não será publicado).</p>
            )}
          </li>
        ))}
      </ul>
      {trailer && (
        <section className="mt-4">
          <h2 className="text-lg font-bold">Trailer</h2>
          <video controls preload="none" className="mt-2 aspect-[9/16] max-h-[60vh] w-auto rounded-xl bg-black" src={trailer} />
        </section>
      )}

      <section className="card mt-6 grid gap-4 sm:grid-cols-2">
        <ActionForm action={approveReviewAction}>
          <input type="hidden" name="id" value={s.id} />
          <SubmitButton className="btn-primary w-full" pendingText="A publicar…">Aprovar e publicar</SubmitButton>
        </ActionForm>
        <ActionForm action={rejectReviewAction} className="space-y-2">
          <input type="hidden" name="id" value={s.id} />
          <label className="label" htmlFor="reason">Motivo da recusa (o artista vai ver)</label>
          <textarea id="reason" name="reason" className="input" rows={2} required minLength={5} placeholder="Ex.: o som do episódio 2 está muito baixo" />
          <SubmitButton className="btn-danger w-full" pendingText="…">Recusar</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
