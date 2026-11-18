import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { mediaUrl } from "@/lib/media";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { coinsLabel } from "@/lib/money";
import { episodePriceCoins } from "@/domain/coins/service";
import { isEpisodeEditable, isSeriesEditable } from "@/domain/series-workflow";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CoverInput } from "@/components/CoverInput";
import { DirectVideoUpload } from "@/components/DirectVideoUpload";
import { EmptyState } from "@/components/EmptyState";
import { IconFilm } from "@/components/icons";
import {
  addEpisodeAction, deleteEpisodeAction, finishArtistVideoUpload, moveEpisodeAction, saveEpisodeAction, saveSeriesDetailsAction, startArtistVideoUpload, submitForReviewAction,
} from "../actions";

export const metadata: Metadata = { title: "A minha série" };
export const dynamic = "force-dynamic";

const SERIES_LABEL: Record<string, [string, string, string]> = {
  DRAFT: ["Rascunho", "badge-muted", "Ainda só tu vês esta série. Quando estiver pronta, envia para revisão."],
  IN_REVIEW: ["Enviada para revisão", "badge-pending", "A equipa está a ver a tua série. Recebes uma notificação quando for aprovada."],
  APPROVED: ["Aprovada", "badge-unlocked", "Aprovada pela equipa."],
  PUBLISHED: ["Publicada", "badge-free", "Está no catálogo. Episódios novos também passam por revisão antes de aparecer."],
  REJECTED: ["Recusada", "badge-danger", "Corrige o que a equipa pediu e envia outra vez."],
  HIDDEN: ["Retirada", "badge-muted", "Esta série foi retirada do catálogo."],
};
const EP_LABEL: Record<string, [string, string]> = {
  DRAFT: ["Rascunho", "badge-muted"],
  IN_REVIEW: ["Em revisão", "badge-pending"],
  PUBLISHED: ["Publicado", "badge-free"],
  REJECTED: ["Recusado", "badge-danger"],
};

export default async function ManageSeriesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string; enviado?: string; semvideo?: string }> }) {
  const { artist } = await requireArtist({ approved: true });
  const { id } = await params;
  const { criada, enviado, semvideo } = await searchParams;
  const s = await db.series.findUnique({ where: { id }, include: { episodes: { orderBy: { number: "asc" } } } });
  if (!s || s.artistId !== artist.id) notFound();
  const [cover, price] = await Promise.all([mediaUrl(s.coverKey), episodePriceCoins(db, s)]);
  const editable = isSeriesEditable(s.status);
  const pending = s.episodes.filter((e) => isEpisodeEditable(e.status));
  const readyToSend = pending.filter((e) => e.videoKey).length;
  const canSubmit = s.status !== "HIDDEN" && (editable ? !!s.coverKey && s.episodes.some((e) => e.videoKey) : readyToSend > 0);
  const [label, badge, help] = SERIES_LABEL[s.status];

  return (
    <div className="container-app max-w-2xl">
      <Link href="/artista" className="text-sm text-muted">← Painel</Link>
      {enviado && (
        <p role="status" className="mt-2 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">
          Enviado para revisão ({enviado} episódio(s)).{semvideo ? ` ${semvideo} episódio(s) sem vídeo ficaram em rascunho.` : ""} Avisamos-te quando estiver publicado.
        </p>
      )}
      {criada && <p role="status" className="mt-2 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">Série criada! Agora adiciona os episódios e carrega os vídeos.</p>}

      <header className="mt-2 flex items-start gap-3">
        <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{s.title}</h1>
          <span className={`${badge} mt-1`}>{label}</span>
          <p className="mt-1 text-sm text-muted">{help}</p>
        </div>
      </header>
      {s.status === "REJECTED" && s.rejectionReason && <p className="mt-3 rounded-xl bg-danger/15 px-4 py-3 text-sm text-danger">Motivo: {s.rejectionReason}</p>}

      <section className="card mt-4 text-sm text-muted">
        Definido pela plataforma: os primeiros <strong className="text-fg">{s.freeEpisodes} episódios são grátis</strong> e os seguintes custam <strong className="text-fg">{coinsLabel(price)}</strong>. Ganhas 50% do valor das moedas gastas nos teus episódios.
      </section>

      {/* Episódios */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">Episódios ({s.episodes.length}/{s.plannedEpisodes})</h2>
        {s.episodes.length === 0 && <EmptyState icon={<IconFilm size={24} />} title="Ainda sem episódios" text="Adiciona o episódio 1 em baixo e carrega o vídeo." />}
        <ul className="mt-2 space-y-3">
          {s.episodes.map((e, i) => {
            const canEdit = isEpisodeEditable(e.status);
            const isLastFree = e.number === s.freeEpisodes;
            return (
              <li key={e.id} className="card">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Episódio {e.number}{e.number <= s.freeEpisodes ? " · grátis" : ""}</p>
                  <span className={EP_LABEL[e.status][1]}>{EP_LABEL[e.status][0]}</span>
                </div>
                {e.status === "REJECTED" && e.rejectionReason && <p className="mt-2 text-sm text-danger">Motivo: {e.rejectionReason}</p>}
                {canEdit ? (
                  <>
                    <ActionForm action={saveEpisodeAction} className="mt-3 space-y-3">
                      <input type="hidden" name="episodeId" value={e.id} />
                      <div><label className="label" htmlFor={`t-${e.id}`}>Título</label><input className="input" id={`t-${e.id}`} name="title" defaultValue={e.title} required maxLength={100} /></div>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="endsWithHook" defaultChecked={e.endsWithHook} className="checkbox mt-0" /> Termina em gancho (suspense){isLastFree ? " — recomendado: é o último grátis" : ""}</label>
                      <div><label className="label" htmlFor={`h-${e.id}`}>Texto do gancho (aparece no ecrã “Queres saber o que acontece?”)</label><input className="input" id={`h-${e.id}`} name="hookText" defaultValue={e.hookText ?? ""} maxLength={200} /></div>
                      <div><label className="label" htmlFor={`s-${e.id}`}>Legendas .vtt (opcional){e.subtitlesKey ? " — já carregadas" : ""}</label><input className="input" id={`s-${e.id}`} name="subtitles" type="file" accept=".vtt,text/vtt" /></div>
                      <SubmitButton className="btn-secondary w-full">Guardar episódio</SubmitButton>
                    </ActionForm>
                    <div className="mt-3">
                      <DirectVideoUpload
                        start={startArtistVideoUpload.bind(null, e.id, "episode")}
                        finish={finishArtistVideoUpload.bind(null, e.id, "episode")}
                        hasVideo={!!e.videoKey}
                        label={e.videoKey ? `Vídeo carregado${e.durationSec ? ` (${Math.round(e.durationSec / 60) || 1} min)` : ""}` : "Vídeo do episódio"}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {i > 0 && isEpisodeEditable(s.episodes[i - 1].status) && (
                        <ActionForm action={moveEpisodeAction}><input type="hidden" name="episodeId" value={e.id} /><input type="hidden" name="dir" value="up" /><SubmitButton className="btn-ghost btn-sm border border-white/10" pendingText="…">↑ Subir</SubmitButton></ActionForm>
                      )}
                      {i < s.episodes.length - 1 && isEpisodeEditable(s.episodes[i + 1].status) && (
                        <ActionForm action={moveEpisodeAction}><input type="hidden" name="episodeId" value={e.id} /><input type="hidden" name="dir" value="down" /><SubmitButton className="btn-ghost btn-sm border border-white/10" pendingText="…">↓ Descer</SubmitButton></ActionForm>
                      )}
                      <ActionForm action={deleteEpisodeAction}><input type="hidden" name="episodeId" value={e.id} /><SubmitButton className="btn-danger btn-sm" pendingText="…">Apagar</SubmitButton></ActionForm>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">{e.title}{e.status === "IN_REVIEW" ? " — à espera da revisão." : ""}</p>
                )}
              </li>
            );
          })}
        </ul>
        {s.status !== "HIDDEN" && (
          <ActionForm action={addEpisodeAction} className="card mt-3 flex flex-wrap items-end gap-2" resetOnSuccess>
            <input type="hidden" name="seriesId" value={s.id} />
            <div className="min-w-0 flex-1"><label className="label" htmlFor="new-ep">Novo episódio (n.º {(s.episodes.at(-1)?.number ?? 0) + 1})</label><input className="input" id="new-ep" name="title" placeholder="Título do episódio" required maxLength={100} /></div>
            <SubmitButton className="btn-secondary">Adicionar</SubmitButton>
          </ActionForm>
        )}
      </section>

      {/* Enviar para revisão */}
      {s.status !== "HIDDEN" && s.status !== "IN_REVIEW" && (
        <section className="card mt-6 border border-accent/40">
          <h2 className="font-bold">{editable ? "Pronta? Envia para revisão" : "Episódios novos"}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {editable && <li>{s.coverKey ? "✓" : "✗"} Capa carregada</li>}
            {editable && <li>{s.episodes.some((e) => e.videoKey) ? "✓" : "✗"} Pelo menos um episódio com vídeo</li>}
            <li>{readyToSend} episódio(s) com vídeo prontos para enviar</li>
          </ul>
          <ActionForm action={submitForReviewAction} className="mt-3">
            <input type="hidden" name="seriesId" value={s.id} />
            <SubmitButton className="btn-primary w-full" pendingText="A enviar…">Enviar para revisão</SubmitButton>
          </ActionForm>
          {!canSubmit && <p className="mt-2 text-xs text-muted">Completa os pontos acima para poderes enviar.</p>}
        </section>
      )}

      {/* Trailer */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">Trailer (opcional)</h2>
        <p className="text-sm text-muted">Um vídeo curto (até 30 s) para publicares no TikTok/Instagram e para a equipa usar na promoção.</p>
        <div className="mt-2">
          <DirectVideoUpload start={startArtistVideoUpload.bind(null, s.id, "trailer")} finish={finishArtistVideoUpload.bind(null, s.id, "trailer")} hasVideo={!!s.trailerKey} label={s.trailerKey ? "Trailer carregado" : "Carregar trailer"} />
        </div>
      </section>

      {/* Dados da série */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">Dados da série</h2>
        {editable ? (
          <ActionForm action={saveSeriesDetailsAction} className="card mt-2 space-y-3">
            <input type="hidden" name="seriesId" value={s.id} />
            <div><label className="label" htmlFor="title">Título</label><input className="input" id="title" name="title" defaultValue={s.title} required maxLength={80} /></div>
            <div><label className="label" htmlFor="synopsis">Sinopse</label><textarea className="input" id="synopsis" name="synopsis" rows={3} defaultValue={s.synopsis} maxLength={600} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="category">Categoria</label>
                <select className="input" id="category" name="category" defaultValue={s.category}>{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select>
              </div>
              <div><label className="label" htmlFor="plannedEpisodes">Episódios previstos</label><input className="input" id="plannedEpisodes" name="plannedEpisodes" type="number" min={1} max={200} defaultValue={s.plannedEpisodes} required /></div>
            </div>
            <CoverInput current={cover} />
            <SubmitButton className="btn-secondary w-full">Guardar dados</SubmitButton>
          </ActionForm>
        ) : (
          <p className="mt-2 text-sm text-muted">{s.synopsis || "Sem sinopse."} · {CATEGORY_LABELS[s.category]}. Para mudar os dados de uma série enviada ou publicada, fala com a equipa.</p>
        )}
      </section>
    </div>
  );
}
