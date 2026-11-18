import type { Metadata } from "next";
import type { BannerSlide } from "@prisma/client";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DirectVideoUpload } from "@/components/DirectVideoUpload";
import { ctaHref } from "@/domain/banner";
import {
  deleteSlideAction, finishSlideVideoUpload, removeSlideVideoAction, saveCreatorsImageAction, saveSlideAction, startSlideVideoUpload,
} from "./actions";

export const metadata: Metadata = { title: "Banner" };

const ymd = (d: Date | null) => (d ? new Date(d.getTime() + 3600_000).toISOString().slice(0, 10) : "");

function SlideFields({ s, series }: { s?: BannerSlide; series: { slug: string; title: string }[] }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="sm:col-span-2"><label className="label" htmlFor={`t-${s?.id ?? "n"}`}>Título (texto por cima da imagem)</label><input className="input" id={`t-${s?.id ?? "n"}`} name="title" defaultValue={s?.title} required maxLength={60} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={`f-${s?.id ?? "n"}`}>Frase</label><input className="input" id={`f-${s?.id ?? "n"}`} name="subtitle" defaultValue={s?.subtitle ?? ""} maxLength={160} /></div>
      <div><label className="label" htmlFor={`b-${s?.id ?? "n"}`}>Texto do botão</label><input className="input" id={`b-${s?.id ?? "n"}`} name="ctaText" defaultValue={s?.ctaText ?? ""} maxLength={30} placeholder="Ex.: Ver grátis" /></div>
      <div>
        <label className="label" htmlFor={`k-${s?.id ?? "n"}`}>O botão leva a</label>
        <select className="input" id={`k-${s?.id ?? "n"}`} name="ctaKind" defaultValue={s?.ctaKind ?? "NONE"}>
          <option value="NONE">Sem botão</option>
          <option value="SERIES">Uma série</option>
          <option value="CREATORS">Página de criadores</option>
          <option value="STORE">Loja</option>
          <option value="LINK">Link interno</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`d-${s?.id ?? "n"}`}>Série (se escolheres “Uma série”) ou link interno (ex.: /ranking)</label>
        <input className="input" id={`d-${s?.id ?? "n"}`} name="ctaTarget" defaultValue={s?.ctaTarget ?? ""} list="banner-series" placeholder="nome-da-serie ou /ranking" />
      </div>
      <div><label className="label" htmlFor={`o-${s?.id ?? "n"}`}>Ordem</label><input className="input" id={`o-${s?.id ?? "n"}`} name="sortOrder" type="number" min={0} defaultValue={s?.sortOrder ?? 0} /></div>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="active" defaultChecked={s ? s.active : true} className="checkbox mt-0" /> Ativo</label>
      <div><label className="label" htmlFor={`i-${s?.id ?? "n"}`}>Começa a</label><input className="input" id={`i-${s?.id ?? "n"}`} name="startsAt" type="date" defaultValue={ymd(s?.startsAt ?? null)} /></div>
      <div><label className="label" htmlFor={`e-${s?.id ?? "n"}`}>Acaba a</label><input className="input" id={`e-${s?.id ?? "n"}`} name="endsAt" type="date" defaultValue={ymd(s?.endsAt ?? null)} /></div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`img-${s?.id ?? "n"}`}>Imagem {s ? "(substituir)" : "(obrigatória — também é a capa do vídeo)"} · horizontal, sem texto escrito</label>
        <input className="input" id={`img-${s?.id ?? "n"}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!s} />
      </div>
      <datalist id="banner-series">{series.map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}</datalist>
    </>
  );
}

export default async function AdminBanner() {
  const [slides, series, creatorsKey] = await Promise.all([
    db.bannerSlide.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.series.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, title: true }, orderBy: { title: "asc" } }),
    db.setting.findUnique({ where: { key: "creatorsImageKey" } }),
  ]);
  const images = await Promise.all(slides.map((s) => mediaUrl(s.imageKey)));
  const creatorsImg = await mediaUrl(creatorsKey?.value);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Banner da página inicial</h1>
      <p className="mt-1 text-sm text-muted">Os slides passam sozinhos a cada 6 segundos. O título, a frase e o botão aparecem por cima da imagem. Vídeo: MP4 sem som, até 20 s e 8 MB (com “Poupar dados” ou internet lenta mostra-se só a imagem). Sem slides ativos, aparece o slide padrão da KONTA.</p>

      <ul className="mt-4 space-y-4">
        {slides.map((s, i) => (
          <li key={s.id} className="card space-y-3">
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-surface2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {images[i] && <img src={images[i]!} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-col justify-end">
                <p className="font-display text-lg font-extrabold">{s.title}</p>
                {s.subtitle && <p className="text-xs">{s.subtitle}</p>}
                {s.ctaText && <span className="mt-1 self-start rounded-full bg-accent px-3 py-1 text-xs font-bold text-[#1A0E05]">{s.ctaText} → {ctaHref(s) ?? "?"}</span>}
              </div>
              <span className={`absolute right-2 top-2 ${s.active ? "badge-free" : "badge-muted"}`}>{s.active ? "Ativo" : "Inativo"}</span>
            </div>
            <ActionForm action={saveSlideAction} className="grid gap-3 sm:grid-cols-2">
              <SlideFields s={s} series={series} />
              <div className="sm:col-span-2"><SubmitButton className="btn-secondary w-full">Guardar slide</SubmitButton></div>
            </ActionForm>
            <div>
              <DirectVideoUpload
                start={startSlideVideoUpload.bind(null, s.id)}
                finish={finishSlideVideoUpload.bind(null, s.id)}
                hasVideo={!!s.videoKey}
                label={s.videoKey ? `Vídeo carregado (${s.videoSec ?? "?"} s)` : "Vídeo curto (opcional)"}
                maxMb={8}
                maxSec={20}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {s.videoKey && <ActionForm action={removeSlideVideoAction}><input type="hidden" name="id" value={s.id} /><SubmitButton className="btn-secondary btn-sm">Tirar o vídeo</SubmitButton></ActionForm>}
              <ActionForm action={deleteSlideAction}><input type="hidden" name="id" value={s.id} /><SubmitButton className="btn-danger btn-sm">Apagar slide</SubmitButton></ActionForm>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-bold">Novo slide</h2>
      <ActionForm action={saveSlideAction} className="card mt-2 grid gap-3 sm:grid-cols-2" resetOnSuccess>
        <SlideFields series={series} />
        <div className="sm:col-span-2"><SubmitButton className="btn-primary w-full">Criar slide</SubmitButton></div>
      </ActionForm>

      <h2 className="mt-8 text-lg font-bold">Imagem da “Área dos criadores”</h2>
      <p className="text-sm text-muted">Usa só fotos reais e autorizadas (por exemplo, um criador com a t-shirt KONTA). Aparece à direita no bloco “A tua história pode valer muito mais.”</p>
      <div className="card mt-2 grid gap-3 sm:grid-cols-[140px_1fr]">
        <div className="aspect-[3/4] overflow-hidden rounded-xl bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {creatorsImg ? <img src={creatorsImg} alt="" className="h-full w-full object-cover" /> : <p className="p-3 text-xs text-muted">Ainda sem imagem (aparece o fundo gráfico da marca).</p>}
        </div>
        <ActionForm action={saveCreatorsImageAction} className="space-y-2">
          <input className="input" name="image" type="file" accept="image/jpeg,image/png,image/webp" required aria-label="Imagem da Área dos criadores" />
          <SubmitButton className="btn-primary">Guardar imagem</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
