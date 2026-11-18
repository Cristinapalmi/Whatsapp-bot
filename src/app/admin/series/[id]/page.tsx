import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { AGE_LABELS, CATEGORY_LABELS, LANGUAGE_LABELS } from "@/lib/categories";
import { getObjectUrl } from "@/domain/storage";
import { formatDate } from "@/lib/dates";
import { withdrawnUntil } from "@/domain/series-workflow";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import {
  approveReviewAction, rejectReviewAction, setFeaturedAction, setPremiumAction, setSeriesStatusAction, setSuggestedSeriesAction,
} from "../../actions";

export const metadata: Metadata = { title: "Série" };

const STATUS: Record<string, string> = {
  DRAFT: "Rascunho do artista", IN_REVIEW: "Enviada para revisão", APPROVED: "Aprovada", PUBLISHED: "Publicada", REJECTED: "Recusada", HIDDEN: "Retirada",
};
const EP_STATUS: Record<string, string> = { DRAFT: "rascunho", IN_REVIEW: "por rever", PUBLISHED: "publicado", REJECTED: "recusado" };
const TIER: Record<string, string> = { ENTRY: "Entrada", NORMAL: "Normal ⭐", PREMIUM: "Premium 💎" };

/** O admin só revê: vê tudo e decide (publicar, recusar, retirar, destaque, sugestão, Premium). Quem edita é o artista. */
export default async function AdminSeriesDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.series.findUnique({
    where: { id },
    include: { artist: { include: { user: { select: { phone: true } } } }, episodes: { orderBy: { number: "asc" } } },
  });
  if (!s) notFound();
  const [cover, trailer, isSuggested] = await Promise.all([
    mediaUrl(s.coverKey),
    s.trailerKey ? getObjectUrl("media", s.trailerKey, 3600) : null,
    db.setting.findUnique({ where: { key: "suggestedSeriesId" } }).then((r) => r?.value === s.id),
  ]);
  const videos = await Promise.all(s.episodes.map((e) => (e.videoKey ? getObjectUrl("media", e.videoKey, 3600) : null)));
  const subs = await Promise.all(s.episodes.map((e) => (e.subtitlesKey ? getObjectUrl("media", e.subtitlesKey, 3600) : null)));
  const pendingEpisodes = s.episodes.some((e) => e.status === "IN_REVIEW");
  const inReview = s.status === "IN_REVIEW" || (s.status === "PUBLISHED" && pendingEpisodes);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/series" className="text-sm text-muted">← Séries</Link>
      <div className="mt-2 grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt="Capa" className="h-full w-full object-cover" /> : <p className="p-3 text-sm text-danger">Sem capa</p>}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{s.title}</h1>
          <p className="text-sm text-muted">
            <Link href={`/admin/artistas`} className="underline">{s.artist.stageName}</Link> ({s.artist.fullName} · {s.artist.user.phone})
          </p>
          <p className="mt-1 text-sm">
            <strong>{STATUS[s.status]}</strong> · {CATEGORY_LABELS[s.category]} · {AGE_LABELS[s.ageRating]} · {LANGUAGE_LABELS[s.language] ?? s.language} · nível {TIER[s.tier]}
            {s.featured && " · ⭐ em destaque"}{isSuggested && " · sugerida ao abrir"}
          </p>
          {s.tags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{s.tags.map((t) => <span key={t} className="badge-muted">{t}</span>)}</p>}
          <p className="mt-3 whitespace-pre-line text-sm">{s.synopsis || <span className="text-muted">Sem sinopse.</span>}</p>
          {s.rejectionReason && <p className="mt-2 text-sm text-danger">Motivo registado: {s.rejectionReason}</p>}
          {s.withdrawnAt && <p className="mt-2 text-sm text-warn">Retirada pelo artista a {formatDate(s.withdrawnAt)}{s.withdrawReason ? ` (“${s.withdrawReason}”)` : ""}. Quem desbloqueou vê até {formatDate(withdrawnUntil(s.withdrawnAt))}.{s.purgedAt ? " Ficheiros já apagados." : ""}</p>}
          {s.status === "PUBLISHED" && <p className="mt-2 text-sm"><Link href={`/serie/${s.slug}`} className="text-accent2 underline">Ver página pública</Link></p>}
        </div>
      </div>

      {/* Decisões */}
      <section className="card mt-6 space-y-4">
        <h2 className="font-bold">Decisões</h2>
        {inReview && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionForm action={approveReviewAction}>
              <input type="hidden" name="id" value={s.id} />
              <SubmitButton className="btn-primary w-full" pendingText="A publicar…">Aprovar e publicar</SubmitButton>
            </ActionForm>
            <ActionForm action={rejectReviewAction} className="space-y-2">
              <input type="hidden" name="id" value={s.id} />
              <label className="label" htmlFor="reason">Motivo da recusa (obrigatório — o artista vai ver)</label>
              <textarea id="reason" name="reason" className="input" rows={2} required minLength={5} />
              <SubmitButton className="btn-danger w-full" pendingText="…">Recusar</SubmitButton>
            </ActionForm>
          </div>
        )}
        {s.status === "PUBLISHED" && (
          <>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={setFeaturedAction}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="on" value={s.featured ? "0" : "1"} />
                <SubmitButton className={s.featured ? "btn-secondary" : "btn-primary"}>{s.featured ? "Tirar do destaque" : "Destaque na página inicial"}</SubmitButton>
              </ActionForm>
              <ActionForm action={setSuggestedSeriesAction}>
                <input type="hidden" name="id" value={isSuggested ? "" : s.id} />
                <SubmitButton className={isSuggested ? "btn-secondary" : "btn-primary"}>{isSuggested ? "Deixar de sugerir" : "Sugerir ao abrir a app"}</SubmitButton>
              </ActionForm>
              <ActionForm action={setPremiumAction}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="on" value={s.tier === "PREMIUM" ? "0" : "1"} />
                <SubmitButton className="btn-secondary">{s.tier === "PREMIUM" ? "Tirar Premium (volta a Normal)" : "Marcar como Premium 💎"}</SubmitButton>
              </ActionForm>
            </div>
            <ActionForm action={setSeriesStatusAction} className="space-y-2 border-t border-white/5 pt-4">
              <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="HIDDEN" />
              <label className="label" htmlFor="hide-reason">Retirar do catálogo — motivo (o artista vai ver)</label>
              <input id="hide-reason" name="reason" className="input" required minLength={3} />
              <SubmitButton className="btn-danger">Retirar do catálogo</SubmitButton>
            </ActionForm>
          </>
        )}
        {s.status === "HIDDEN" && !s.withdrawnAt && !s.purgedAt && (
          <ActionForm action={setSeriesStatusAction}>
            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="PUBLISHED" />
            <SubmitButton className="btn-secondary">Voltar a publicar</SubmitButton>
          </ActionForm>
        )}
        {!inReview && s.status !== "PUBLISHED" && s.status !== "HIDDEN" && <p className="text-sm text-muted">Nada a decidir: a série está com o artista ({STATUS[s.status].toLowerCase()}).</p>}
      </section>

      {trailer && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Trailer</h2>
          <video controls preload="none" className="mt-2 aspect-[9/16] max-h-[60vh] w-auto rounded-xl bg-black" src={trailer} />
        </section>
      )}

      <h2 className="mt-6 text-lg font-bold">Episódios ({s.episodes.length})</h2>
      <ul className="mt-2 space-y-3">
        {s.episodes.map((e, i) => (
          <li key={e.id} className="card">
            <p className="font-semibold">Episódio {e.number}: {e.title} <span className="text-xs font-normal text-muted">· {EP_STATUS[e.status]}{e.number <= s.freeEpisodes ? " · grátis" : ""}</span></p>
            {e.hookText && <p className="text-sm text-muted">Gancho: “{e.hookText}”</p>}
            {videos[i] ? (
              <video controls preload="none" className="mt-2 aspect-[9/16] max-h-[60vh] w-auto rounded-xl bg-black" src={videos[i]!}>
                {subs[i] && <track kind="subtitles" src={subs[i]!} srcLang="pt" label="Português" />}
              </video>
            ) : (
              <p className="mt-2 text-sm text-muted">Sem vídeo.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
