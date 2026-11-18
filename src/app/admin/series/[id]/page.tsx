import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveEpisodeAction, saveSeriesAction, setSeriesStatusAction, setSuggestedSeriesAction } from "../../actions";
import { VideoUploader } from "./VideoUploader";
import { defaultEpisodePriceCoins } from "@/domain/coins/service";
import { CopyButton } from "@/components/CopyButton";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Editar série" };

export default async function AdminSeriesDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.series.findUnique({
    where: { id },
    include: { artist: true, episodes: { orderBy: { number: "asc" } } },
  });
  if (!s) notFound();
  const cover = await mediaUrl(s.coverKey);
  const defaultPrice = await defaultEpisodePriceCoins(db);
  const isSuggested = (await db.setting.findUnique({ where: { key: "suggestedSeriesId" } }))?.value === s.id;
  const trailer = await mediaUrl(s.trailerKey);
  const trailerCmd = `npm run trailer -- ${s.slug}`;
  const nextNumber = (s.episodes.at(-1)?.number ?? 0) + 1;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/series" className="text-sm text-muted">← Séries</Link>
      <h1 className="mt-1 text-2xl font-bold">{s.title}</h1>
      <p className="text-sm text-muted">
        {s.artist.stageName} · estado: <strong>{s.status}</strong>
        {s.socialUrl && <> · <a href={s.socialUrl} target="_blank" rel="noreferrer" className="text-accent2 underline">ver no TikTok/Instagram</a></>}
        {s.status === "PUBLISHED" && <> · <Link href={`/serie/${s.slug}`} className="text-accent2 underline">ver página pública</Link></>}
      </p>

      <section className="mt-4 flex flex-wrap gap-2">
        {(["APPROVED", "PUBLISHED"] as const).filter((st) => st !== s.status).map((st) => (
          <ActionForm key={st} action={setSeriesStatusAction}>
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="status" value={st} />
            <SubmitButton className={st === "PUBLISHED" ? "btn-primary" : "btn-secondary"}>{st === "PUBLISHED" ? "Publicar" : "Aprovar (sem publicar)"}</SubmitButton>
          </ActionForm>
        ))}
        <ActionForm action={setSeriesStatusAction} className="flex gap-2">
          <input type="hidden" name="id" value={s.id} />
          <select name="status" className="input w-auto" defaultValue="HIDDEN">
            <option value="HIDDEN">Retirar</option>
            <option value="REJECTED">Rejeitar</option>
          </select>
          <input name="reason" className="input" placeholder="Motivo" required minLength={3} />
          <SubmitButton className="btn-danger">OK</SubmitButton>
        </ActionForm>
      </section>

      <section className="card mt-6">
        <h2 className="font-bold">Sugestão ao abrir a app</h2>
        <p className="text-sm text-muted">{isSuggested ? "Esta série é a sugestão atual (aparece 1 vez por dia a cada pessoa)." : "Sem escolha tua, a app sugere a série em destaque ou a mais vista."}</p>
        <ActionForm action={setSuggestedSeriesAction} className="mt-3">
          <input type="hidden" name="id" value={isSuggested ? "" : s.id} />
          <SubmitButton className={isSuggested ? "btn-secondary" : "btn-primary"}>{isSuggested ? "Deixar de sugerir (automático)" : "Sugerir esta série ao abrir a app"}</SubmitButton>
        </ActionForm>
      </section>

      <h2 className="mt-8 text-lg font-bold">Definições</h2>
      <ActionForm action={saveSeriesAction} className="card mt-2 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={s.id} />
        <div className="sm:col-span-2"><label className="label" htmlFor="title">Título</label><input className="input" id="title" name="title" defaultValue={s.title} required /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="synopsis">Sinopse</label><textarea className="input" id="synopsis" name="synopsis" rows={3} defaultValue={s.synopsis} /></div>
        <div>
          <label className="label" htmlFor="category">Categoria</label>
          <select className="input" id="category" name="category" defaultValue={s.category}>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="priceCoins">Preço por episódio (moedas)</label>
          <input className="input" id="priceCoins" name="priceCoins" type="number" min={1} defaultValue={s.priceCoins ?? ""} placeholder={`Por defeito: ${defaultPrice}`} />
          <p className="hint">Deixa vazio para usar o preço por defeito ({defaultPrice} moedas). Muda em Admin → Moedas.</p>
        </div>
        <div>
          <label className="label" htmlFor="freeEpisodes">Episódios grátis</label>
          <input className="input" id="freeEpisodes" name="freeEpisodes" type="number" min={0} max={50} defaultValue={s.freeEpisodes} required />
          <p className="hint">O último grátis deve terminar em gancho.</p>
        </div>
        <div>
          <label className="label" htmlFor="plannedEpisodes">Total de episódios previstos</label>
          <input className="input" id="plannedEpisodes" name="plannedEpisodes" type="number" min={1} defaultValue={s.plannedEpisodes} required />
        </div>
        <div>
          <label className="label" htmlFor="cover">Capa (vertical 600×900, até 2 MB)</label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="mb-2 h-32 rounded-lg" />}
          <input className="input" id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <label className="flex items-center gap-3 self-end text-sm"><input type="checkbox" name="featured" defaultChecked={s.featured} className="checkbox" /> Destaque na página inicial</label>
        <div className="sm:col-span-2"><SubmitButton>Guardar definições</SubmitButton></div>
      </ActionForm>

      <h2 className="mt-8 text-lg font-bold">Trailer para as redes sociais</h2>
      <div className="card mt-2 grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="aspect-[9/16] overflow-hidden rounded-xl bg-surface2">
          {trailer ? <video src={trailer} controls preload="none" className="h-full w-full object-cover" /> : <p className="p-3 text-xs text-muted">Ainda sem trailer</p>}
        </div>
        <div className="space-y-3 text-sm">
          <p>Vídeo vertical de ~30 s: excerto do episódio 1 + cartão final "O resto está em … · link na bio" com o link pessoal do artista.</p>
          {s.trailerUpdatedAt && <p className="text-muted">Atualizado: {formatDateTime(s.trailerUpdatedAt)}</p>}
          <p className="font-semibold">Gerar automaticamente (no teu computador):</p>
          <div className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2 font-mono text-xs">
            <span className="flex-1 break-all">{trailerCmd}</span>
            <CopyButton text={trailerCmd} label="Copiar comando" />
          </div>
          <p className="text-xs text-muted">Opções: <code>--inicio 12</code> (segundo onde começa), <code>--duracao 20</code>, <code>--episodio 2</code>. Ver docs/TRAILERS.md.</p>
          <VideoUploader episodeId={s.id} quality="trailer" hasVideo={!!s.trailerKey} label="Ou carregar um trailer feito à mão" />
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold">Episódios</h2>
      <p className="text-sm text-muted">Vídeos em MP4 já comprimidos (ver docs/VIDEOS.md). Carrega a versão 360p (obrigatória) e, se quiseres, a 480p.</p>
      <ul className="mt-2 space-y-3">
        {s.episodes.map((e) => (
          <li key={e.id} className="card">
            <ActionForm action={saveEpisodeAction} className="grid gap-3 sm:grid-cols-[80px_1fr_120px]">
              <input type="hidden" name="seriesId" value={s.id} />
              <input type="hidden" name="id" value={e.id} />
              <div><label className="label" htmlFor={`n-${e.id}`}>N.º</label><input className="input" id={`n-${e.id}`} name="number" type="number" min={1} defaultValue={e.number} /></div>
              <div><label className="label" htmlFor={`t-${e.id}`}>Título</label><input className="input" id={`t-${e.id}`} name="title" defaultValue={e.title} required /></div>
              <div><label className="label" htmlFor={`d-${e.id}`}>Duração (s)</label><input className="input" id={`d-${e.id}`} name="durationSec" type="number" min={0} defaultValue={e.durationSec} /></div>
              <div className="sm:col-span-3"><label className="label" htmlFor={`h-${e.id}`}>Texto do gancho (aparece no ecrã "Queres saber o que acontece?")</label><input className="input" id={`h-${e.id}`} name="hookText" defaultValue={e.hookText ?? ""} maxLength={200} /></div>
              <div className="flex flex-wrap gap-4 text-sm sm:col-span-3">
                <label className="flex items-center gap-2"><input type="checkbox" name="endsWithHook" defaultChecked={e.endsWithHook} className="checkbox mt-0" /> Termina em gancho</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={e.published} className="checkbox mt-0" /> Publicado</label>
                <span className={e.number <= s.freeEpisodes ? "badge-free" : "badge-price"}>{e.number <= s.freeEpisodes ? "Grátis" : "Pago"}</span>
              </div>
              <div className="sm:col-span-3"><label className="label" htmlFor={`s-${e.id}`}>Legendas .vtt {e.subtitlesKey ? "(já carregadas)" : "(opcional)"}</label><input className="input" id={`s-${e.id}`} name="subtitles" type="file" accept=".vtt,text/vtt" /></div>
              <div className="sm:col-span-3"><SubmitButton className="btn-secondary">Guardar episódio</SubmitButton></div>
            </ActionForm>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <VideoUploader episodeId={e.id} quality="low" hasVideo={!!e.videoKey} label="Vídeo 360p (obrigatório)" />
              <VideoUploader episodeId={e.id} quality="medium" hasVideo={!!e.videoKeyHd} label="Vídeo 480p (opcional)" />
            </div>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-bold">Adicionar episódio</h3>
      <ActionForm action={saveEpisodeAction} className="card mt-2 grid gap-3 sm:grid-cols-[80px_1fr]" resetOnSuccess>
        <input type="hidden" name="seriesId" value={s.id} />
        <input type="hidden" name="durationSec" value="0" />
        <div><label className="label" htmlFor="new-n">N.º</label><input className="input" id="new-n" name="number" type="number" min={1} defaultValue={nextNumber} /></div>
        <div><label className="label" htmlFor="new-t">Título</label><input className="input" id="new-t" name="title" required /></div>
        <div className="sm:col-span-2"><SubmitButton className="btn-secondary">Adicionar</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
