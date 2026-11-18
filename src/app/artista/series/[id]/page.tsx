import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { mediaUrl } from "@/lib/media";
import { AGE_LABELS, CATEGORY_LABELS, LANGUAGE_LABELS } from "@/lib/categories";
import { coinsLabel, formatKz } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { episodePriceCoins } from "@/domain/coins/service";
import { HOOK_EPISODE, isEpisodeEditable, isSeriesEditable, reviewChecklist, withdrawnUntil } from "@/domain/series-workflow";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DirectVideoUpload } from "@/components/DirectVideoUpload";
import { SeriesDetailsFields } from "@/components/SeriesDetailsFields";
import { IconCheck, IconFilm, IconX } from "@/components/icons";
import {
  addEpisodeAction, deleteEpisodeAction, deleteSeriesAction, finishArtistVideoUpload, moveEpisodeAction, saveEpisodeAction, saveSeriesDetailsAction,
  startArtistVideoUpload, submitForReviewAction, withdrawSeriesAction,
} from "../actions";

export const metadata: Metadata = { title: "A minha série" };
export const dynamic = "force-dynamic";

const SERIES_LABEL: Record<string, [string, string, string]> = {
  DRAFT: ["Rascunho", "badge-muted", "Ainda só tu vês esta série. Adiciona os episódios e, quando estiver pronta, envia para revisão."],
  IN_REVIEW: ["Enviada para revisão", "badge-pending", "A equipa está a ver a tua série. Recebes uma notificação quando for aprovada."],
  APPROVED: ["Aprovada", "badge-unlocked", "Aprovada pela equipa."],
  PUBLISHED: ["Publicada", "badge-free", "Está no catálogo. Episódios novos também passam por revisão antes de aparecer."],
  REJECTED: ["Recusada", "badge-danger", "Corrige o que a equipa pediu e envia outra vez."],
  HIDDEN: ["Retirada", "badge-muted", "Esta série não está no catálogo."],
};
const EP_LABEL: Record<string, [string, string]> = {
  DRAFT: ["Rascunho", "badge-muted"],
  IN_REVIEW: ["Em revisão", "badge-pending"],
  PUBLISHED: ["Publicado", "badge-free"],
  REJECTED: ["Recusado", "badge-danger"],
};
const TIER_LABEL: Record<string, string> = { ENTRY: "Entrada", NORMAL: "Normal ⭐", PREMIUM: "Premium 💎" };

type SP = { criada?: string; enviado?: string; semvideo?: string; retirada?: string };

export default async function ManageSeriesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { artist } = await requireArtist({ approved: true });
  const { id } = await params;
  const sp = await searchParams;
  const s = await db.series.findUnique({ where: { id }, include: { episodes: { orderBy: { number: "asc" } } } });
  if (!s || s.artistId !== artist.id) notFound();
  const [cover, price] = await Promise.all([mediaUrl(s.coverKey), episodePriceCoins(db, s)]);
  const editable = isSeriesEditable(s.status);
  const checklist = reviewChecklist(s, s.episodes);
  const canSubmit = s.status !== "HIDDEN" && s.status !== "IN_REVIEW" && checklist.every((c) => c.ok);
  const [label, badge, help] = SERIES_LABEL[s.status];
  const nextNumber = (s.episodes.at(-1)?.number ?? 0) + 1;
  const earned = await db.coinSpend.aggregate({ where: { artistId: artist.id, episode: { seriesId: s.id }, reversedAt: null }, _sum: { artistCents: true } });

  return (
    <div className="container-app max-w-2xl">
      <Link href="/artista" className="text-sm text-muted">← Painel</Link>
      {sp.enviado && (
        <p role="status" className="mt-2 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">
          Enviado para revisão ({sp.enviado} episódio(s)).{sp.semvideo ? ` ${sp.semvideo} episódio(s) sem vídeo ficaram em rascunho.` : ""} Avisamos-te quando estiver publicado.
        </p>
      )}
      {sp.retirada && <p role="status" className="mt-2 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">Série retirada da KONTA. O dinheiro que ganhaste continua no teu saldo.</p>}

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
      {s.withdrawnAt && (
        <p className="mt-3 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
          Retirada a {formatDate(s.withdrawnAt)}. Quem já desbloqueou episódios pode vê-los até {formatDate(withdrawnUntil(s.withdrawnAt))}; depois os vídeos e a capa são apagados.
        </p>
      )}

      {/* Série vs episódio: botão grande logo depois de criar */}
      {sp.criada && (
        <a href="#novo-episodio" className="mt-4 block rounded-3xl bg-gradient-to-br from-accent/30 to-surface p-5 no-underline">
          <p className="font-display text-xl font-extrabold text-fg">+ Adicionar episódio</p>
          <p className="mt-1 text-sm text-fg/85">Uma série tem vários episódios. Adiciona aqui o episódio 1, 2, 3…</p>
        </a>
      )}

      <section className="card mt-4 text-sm text-muted">
        Nível de preço: <strong className="text-fg">{TIER_LABEL[s.tier]}</strong> ({coinsLabel(price)} por episódio, definido pela plataforma). Os primeiros {s.freeEpisodes} episódios são sempre grátis.
        {s.status === "PUBLISHED" && <> Já ganhaste <strong className="text-ok">{formatKz(earned._sum.artistCents ?? 0)}</strong> com esta série.</>}
      </section>

      {/* Episódios */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">Episódios ({s.episodes.length})</h2>
        {s.episodes.length === 0 && <p className="mt-1 text-sm text-muted">Ainda sem episódios. Começa pelo episódio 1 aqui em baixo.</p>}
        <ul className="mt-2 space-y-3">
          {s.episodes.map((e, i) => {
            const canEdit = isEpisodeEditable(e.status);
            const isHookEp = e.number === HOOK_EPISODE;
            return (
              <li key={e.id} className="card">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Episódio {e.number}{e.number <= s.freeEpisodes ? " · grátis" : ""}</p>
                  <span className={EP_LABEL[e.status][1]}>{EP_LABEL[e.status][0]}</span>
                </div>
                {e.status === "REJECTED" && e.rejectionReason && <p className="mt-2 text-sm text-danger">Motivo: {e.rejectionReason}</p>}
                {canEdit ? (
                  <>
                    <div className="mt-3">
                      <DirectVideoUpload
                        start={startArtistVideoUpload.bind(null, e.id, "episode")}
                        finish={finishArtistVideoUpload.bind(null, e.id, "episode")}
                        hasVideo={!!e.videoKey}
                        label={e.videoKey ? `Vídeo carregado${e.durationSec ? ` (${Math.round(e.durationSec / 60) || 1} min)` : ""}` : "Vídeo do episódio"}
                      />
                    </div>
                    <ActionForm action={saveEpisodeAction} className="mt-3 space-y-3">
                      <input type="hidden" name="episodeId" value={e.id} />
                      <div><label className="label" htmlFor={`t-${e.id}`}>Título</label><input className="input" id={`t-${e.id}`} name="title" defaultValue={e.title} required maxLength={100} /></div>
                      {isHookEp ? (
                        <div className="rounded-xl border border-accent2/40 p-3">
                          <input type="hidden" name="endsWithHook" value="on" />
                          <p className="text-sm font-semibold text-accent2">Gancho obrigatório no episódio {HOOK_EPISODE}</p>
                          <p className="text-xs text-muted">É o último episódio grátis: deve acabar em suspense, para o público querer continuar.</p>
                          <label className="label mt-2" htmlFor={`h-${e.id}`}>Texto do gancho (aparece no ecrã “Queres saber o que acontece?”)</label>
                          <input className="input" id={`h-${e.id}`} name="hookText" defaultValue={e.hookText ?? ""} maxLength={200} required placeholder="Ex.: E quando ela abriu a porta… quem estava lá?" />
                        </div>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="endsWithHook" defaultChecked={e.endsWithHook} className="checkbox mt-0" /> Termina em suspense (opcional)</label>
                          <input type="hidden" name="hookText" value={e.hookText ?? ""} />
                        </>
                      )}
                      <div><label className="label" htmlFor={`s-${e.id}`}>Legendas .vtt (opcional){e.subtitlesKey ? " — já carregadas" : ""}</label><input className="input" id={`s-${e.id}`} name="subtitles" type="file" accept=".vtt,text/vtt" /></div>
                      <SubmitButton className="btn-secondary w-full">Guardar episódio</SubmitButton>
                    </ActionForm>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {i > 0 && isEpisodeEditable(s.episodes[i - 1].status) && (
                        <ActionForm action={moveEpisodeAction}><input type="hidden" name="episodeId" value={e.id} /><input type="hidden" name="dir" value="up" /><SubmitButton className="btn-ghost btn-sm border border-white/10" pendingText="…">↑ Subir</SubmitButton></ActionForm>
                      )}
                      {i < s.episodes.length - 1 && isEpisodeEditable(s.episodes[i + 1].status) && (
                        <ActionForm action={moveEpisodeAction}><input type="hidden" name="episodeId" value={e.id} /><input type="hidden" name="dir" value="down" /><SubmitButton className="btn-ghost btn-sm border border-white/10" pendingText="…">↓ Descer</SubmitButton></ActionForm>
                      )}
                      <ActionForm action={deleteEpisodeAction}><input type="hidden" name="episodeId" value={e.id} /><SubmitButton className="btn-danger btn-sm" pendingText="…">Apagar episódio</SubmitButton></ActionForm>
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
          <ActionForm action={addEpisodeAction} className="mt-3 rounded-2xl border-2 border-dashed border-accent/50 p-4" resetOnSuccess>
            <span id="novo-episodio" />
            <input type="hidden" name="seriesId" value={s.id} />
            <p className="font-display text-lg font-bold">+ Adicionar episódio {nextNumber}</p>
            <p className="text-xs text-muted">Uma série tem vários episódios. Adiciona aqui o episódio 1, 2, 3… (o número é automático).</p>
            <div className="mt-2 flex gap-2">
              <input className="input" name="title" placeholder={`Título do episódio ${nextNumber}`} required maxLength={100} aria-label="Título do episódio" />
              <SubmitButton className="btn-primary shrink-0">Adicionar</SubmitButton>
            </div>
          </ActionForm>
        )}
      </section>

      {/* Lista de verificação + enviar */}
      {s.status !== "HIDDEN" && s.status !== "IN_REVIEW" && (
        <section className="card mt-6 border border-accent/40">
          <h2 className="font-bold">{editable ? "Antes de enviar para revisão" : "Episódios novos"}</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {checklist.map((c) => (
              <li key={c.text} className={`flex items-center gap-2 ${c.ok ? "text-ok" : "text-fg"}`}>
                {c.ok ? <IconCheck size={16} /> : <IconX size={16} className="text-danger" />} {c.text}
              </li>
            ))}
          </ul>
          <ActionForm action={submitForReviewAction} className="mt-3">
            <input type="hidden" name="seriesId" value={s.id} />
            <SubmitButton className="btn-primary w-full" pendingText="A enviar…">Enviar para revisão</SubmitButton>
          </ActionForm>
          {!canSubmit && <p className="mt-2 text-xs text-muted">Completa o que está marcado com ✗ para poderes enviar.</p>}
        </section>
      )}

      {/* Trailer */}
      {!s.purgedAt && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Trailer (opcional)</h2>
          <p className="text-sm text-muted">Um vídeo curto (até 30 s) para promover a série.</p>
          <div className="mt-2">
            <DirectVideoUpload start={startArtistVideoUpload.bind(null, s.id, "trailer")} finish={finishArtistVideoUpload.bind(null, s.id, "trailer")} hasVideo={!!s.trailerKey} label={s.trailerKey ? "Trailer carregado" : "Carregar trailer"} />
          </div>
        </section>
      )}

      {/* Dados da série */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">Dados da série</h2>
        {editable ? (
          <ActionForm action={saveSeriesDetailsAction} className="card mt-2 space-y-3">
            <input type="hidden" name="seriesId" value={s.id} />
            <SeriesDetailsFields s={s} coverUrl={cover} />
            <SubmitButton className="btn-secondary w-full">Guardar dados</SubmitButton>
          </ActionForm>
        ) : (
          <p className="mt-2 text-sm text-muted">{s.synopsis || "Sem sinopse."} · {CATEGORY_LABELS[s.category]} · {AGE_LABELS[s.ageRating]} · {LANGUAGE_LABELS[s.language] ?? s.language}{s.tags.length ? ` · ${s.tags.join(", ")}` : ""}</p>
        )}
      </section>

      {/* Apagar / retirar */}
      {editable && (
        <section className="mt-8">
          <details className="card">
            <summary className="cursor-pointer text-sm font-semibold text-danger">Apagar esta série</summary>
            <ActionForm action={deleteSeriesAction} className="mt-3 space-y-2 text-sm">
              <input type="hidden" name="seriesId" value={s.id} />
              <p className="text-muted">Apaga a série, os episódios e os vídeos. Não dá para desfazer.</p>
              <label className="flex items-center gap-2"><input type="checkbox" name="confirm" className="checkbox mt-0" required /> Sim, quero apagar “{s.title}”</label>
              <SubmitButton className="btn-danger btn-sm">Apagar série</SubmitButton>
            </ActionForm>
          </details>
        </section>
      )}
      {s.status === "PUBLISHED" && (
        <section className="mt-8">
          <details className="card">
            <summary className="cursor-pointer text-sm font-semibold text-danger">Retirar da KONTA</summary>
            <ActionForm action={withdrawSeriesAction} className="mt-3 space-y-2 text-sm">
              <input type="hidden" name="seriesId" value={s.id} />
              <p className="text-muted">A série sai logo do catálogo, da pesquisa, do ranking e das sugestões. Quem já desbloqueou episódios continua a vê-los durante 30 dias; depois os vídeos e a capa são apagados. O dinheiro que ganhaste fica no teu saldo.</p>
              <label className="label" htmlFor="reason">Motivo (opcional)</label>
              <input className="input" id="reason" name="reason" maxLength={300} />
              <label className="flex items-center gap-2"><input type="checkbox" name="confirm" className="checkbox mt-0" required /> Sim, quero retirar “{s.title}”</label>
              <SubmitButton className="btn-danger btn-sm">Retirar série</SubmitButton>
            </ActionForm>
          </details>
        </section>
      )}
      <p className="mt-6 flex items-center gap-2 text-xs text-muted"><IconFilm size={14} /> Os episódios publicados só saem retirando a série.</p>
    </div>
  );
}
