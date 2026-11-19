"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type BannerSlideView = { id: string; title: string; subtitle: string | null; ctaText: string | null; href: string | null; imageUrl: string | null; videoUrl: string | null; highlight?: string };

const INTERVAL = 6000;

/** Vídeos só com boa ligação e sem "Poupar dados". */
function canPlayVideo() {
  try {
    if (localStorage.getItem("dataSaver") === "1") return false;
  } catch {}
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && ["slow-2g", "2g", "3g"].includes(c.effectiveType)) return false;
  return true;
}

/** Fundo gráfico da marca (sem pessoas), para o slide padrão e a Área dos criadores. */
export function BrandBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(70%_90%_at_85%_40%,rgb(var(--c-accent)/0.55),transparent_60%),radial-gradient(50%_60%_at_70%_100%,rgb(var(--c-accent2)/0.35),transparent_65%),linear-gradient(120deg,#120b06,#2a160a)]" aria-hidden>
      <div className="absolute -right-10 top-6 h-64 w-64 rounded-full border-[16px] border-accent/30 sm:right-16 sm:h-80 sm:w-80" />
      <div className="absolute bottom-[-40px] right-28 h-40 w-40 rounded-full border-[8px] border-accent2/30 sm:right-80" />
      <div className="absolute right-6 bottom-10 h-16 w-16 rotate-12 rounded-2xl bg-accent2/25 sm:right-24" />
    </div>
  );
}

/** A borda esquerda da imagem desvanece suavemente para o fundo escuro (sem linha dura). */
const FADE_LEFT: React.CSSProperties = {
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 28%)",
  maskImage: "linear-gradient(to right, transparent 0%, #000 28%)",
};

/** Divide a frase: a 1.ª frase em destaque, o resto mais pequeno. */
function splitSubtitle(s: string | null) {
  if (!s) return { lead: null, rest: null };
  const m = /^(.+?[.!?])\s+(.+)$/.exec(s.trim());
  return m ? { lead: m[1], rest: m[2] } : { lead: s, rest: null };
}

/** Título em duas linhas: o resto em branco e a palavra dourada (por defeito a última) maior, em itálico. */
function Title({ text, highlight }: { text: string; highlight?: string }) {
  const words = text.trim().split(/\s+/);
  let gold = highlight?.trim() || words[words.length - 1];
  const idx = text.toLocaleUpperCase("pt").lastIndexOf(gold.toLocaleUpperCase("pt"));
  if (idx < 0) gold = words[words.length - 1];
  const at = idx < 0 ? text.lastIndexOf(gold) : idx;
  const before = text.slice(0, at).trim();
  const goldText = text.slice(at, at + gold.length);
  const after = text.slice(at + gold.length).trim();
  return (
    <h2 className="font-hero uppercase leading-[0.95]">
      {before && <span className="block max-w-full bg-gradient-to-b from-white to-[#d9d2cb] bg-clip-text text-[clamp(14px,4.4vw,18px)] font-black text-transparent sm:text-[30px] lg:text-[42px]">{before}</span>}
      <span className="block w-max whitespace-nowrap bg-gradient-to-r from-[#FFD36B] via-accent2 to-accent bg-clip-text pr-[0.12em] text-[clamp(18px,5.9vw,24px)] font-black italic text-transparent drop-shadow-[0_2px_10px_rgb(var(--c-accent)/0.55)] sm:text-[40px] lg:text-[58px]">{goldText}</span>
      {after && <span className="block text-[clamp(13px,4vw,16px)] font-black text-white sm:text-[24px] lg:text-[32px]">{after}</span>}
    </h2>
  );
}

/** Banner da página inicial: passa sozinho a cada 6 s, bolinhas na faixa de baixo, deslizar com o dedo. */
export function BannerCarousel({ slides }: { slides: BannerSlideView[] }) {
  const [i, setI] = useState(0);
  const [video, setVideo] = useState(false);
  const touch = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const n = slides.length;

  useEffect(() => setVideo(canPlayVideo()), []);
  const restart = () => {
    if (timer.current) clearInterval(timer.current);
    if (n > 1) timer.current = setInterval(() => setI((x) => (x + 1) % n), INTERVAL);
  };
  useEffect(() => {
    restart();
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  const go = (to: number) => { setI(((to % n) + n) % n); restart(); };

  return (
    <section className="sm:container-app" aria-roledescription="carrossel" aria-label="Destaques">
      <div className="overflow-hidden border-y border-accent/25 shadow-[0_12px_40px_-14px_rgb(var(--c-accent)/0.55)] sm:rounded-3xl sm:border">
        {/* Formato baixo e largo (2,4:1); no computador até 420 px de altura */}
        <div
          className="relative aspect-[1.85/1] max-h-[420px] w-full sm:aspect-[2.4/1] bg-[linear-gradient(120deg,#2b170b_0%,#170d07_30%,#0b0604_55%,#0b0604_100%)]"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
          }}
        >
          {slides.map((s, k) => {
            const { lead, rest } = splitSubtitle(s.subtitle);
            return (
              <div key={s.id} className={`absolute inset-0 transition-opacity duration-700 ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={k !== i}>
                {/* ESQUERDA (46%): o fundo escuro quente é o do próprio banner (sem emendas) */}
                {/* DIREITA (54%): imagem ou vídeo, sem filtros; a borda esquerda desvanece para o escuro */}
                <div className="absolute inset-y-0 right-0 w-[54%]" style={FADE_LEFT}>
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading={k === 0 ? "eager" : "lazy"} />
                  ) : (
                    <BrandBackdrop />
                  )}
                  {video && s.videoUrl && k === i && (
                    <video src={s.videoUrl} poster={s.imageUrl ?? undefined} muted loop playsInline autoPlay preload="none" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </div>
                {/* Texto só na zona da esquerda */}
                <div className="absolute inset-y-0 left-0 flex w-[46%] flex-col justify-center py-2 pl-3 pr-1 sm:pl-8 sm:pr-4 lg:pl-12">
                  <Title text={s.title} highlight={s.highlight} />
                  {lead && <p className="mt-1 text-[12px] font-bold leading-tight text-white sm:mt-3 sm:text-[18px] lg:text-[22px]">{lead}</p>}
                  {rest && <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-white/85 sm:mt-1.5 sm:text-[13px] lg:text-[15px]">{rest}</p>}
                  {s.ctaText && s.href && (
                    <Link
                      href={s.href}
                      tabIndex={k === i ? 0 : -1}
                      className="btn-glow mt-2 min-h-[44px] self-start whitespace-nowrap rounded-full px-4 py-0 text-[12px] font-extrabold no-underline sm:mt-4 sm:px-6 sm:text-base"
                    >
                      {s.ctaText}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Faixa por baixo do banner: estrela dourada, frase e bolinhas */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#1c120a] via-[#140d08] to-[#1c120a] px-3 py-2.5 sm:px-5">
          <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0 text-accent2 drop-shadow-[0_0_6px_rgb(var(--c-accent2)/0.7)]" aria-hidden><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8L12 2.5z" fill="currentColor" /></svg>
          <p className="min-w-0 flex-1 text-[11px] font-semibold leading-tight text-white sm:text-sm">Histórias angolanas. Criadores locais. Entretenimento de qualidade.</p>
          {n > 1 && (
            <div className="flex shrink-0 gap-1.5">
              {slides.map((s, k) => (
                <button key={s.id} type="button" onClick={() => go(k)} aria-label={`Destaque ${k + 1} de ${n}`} aria-current={k === i} className="flex h-6 w-5 items-center justify-center">
                  <span className={`h-2.5 w-2.5 rounded-full border transition ${k === i ? "border-accent2 bg-accent2" : "border-white/60 bg-transparent"}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
