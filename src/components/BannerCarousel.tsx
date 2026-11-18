"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type BannerSlideView = { id: string; title: string; subtitle: string | null; ctaText: string | null; href: string | null; imageUrl: string | null; videoUrl: string | null; highlight?: string };

/** Título com uma palavra em dourado (ex.: "MINISSÉRIES ANGOLANAS"). */
function Title({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !text.includes(highlight)) return <>{text}</>;
  const [a, b] = text.split(highlight);
  return <>{a}<span className="bg-gradient-to-r from-accent2 to-[#FFE08A] bg-clip-text text-transparent">{highlight}</span>{b}</>;
}

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

/** Fundo gráfico da marca (sem pessoas), para o slide padrão. */
export function BrandBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_80%_10%,rgb(var(--c-accent)/0.45),transparent_55%),radial-gradient(90%_80%_at_10%_90%,rgb(var(--c-accent2)/0.30),transparent_60%)] bg-surface" aria-hidden>
      <div className="absolute -right-16 -top-10 h-64 w-64 rounded-full border-[18px] border-accent/30" />
      <div className="absolute -bottom-20 left-10 h-56 w-56 rounded-full border-[10px] border-accent2/25" />
      <div className="absolute right-10 bottom-16 h-24 w-24 rotate-12 rounded-3xl bg-accent/20" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 70 Q25 50 50 65 T100 55 V100 H0Z" fill="currentColor" /></svg>
    </div>
  );
}

/** Banner da página inicial: passa sozinho a cada 6 s, bolinhas em baixo, deslizar com o dedo. */
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
    <section className="container-app" aria-roledescription="carrossel" aria-label="Destaques">
      <div
        className="glow-accent relative h-[min(58vh,460px)] overflow-hidden rounded-3xl border border-accent/25 bg-surface"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        {slides.map((s, k) => (
          <div key={s.id} className={`absolute inset-0 transition-opacity duration-700 ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={k !== i}>
            {s.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading={k === 0 ? "eager" : "lazy"} />
            ) : (
              <BrandBackdrop />
            )}
            {video && s.videoUrl && k === i && (
              <video src={s.videoUrl} poster={s.imageUrl ?? undefined} muted loop playsInline autoPlay preload="none" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {/* Gradiente forte por trás do texto (escuro em baixo + brilho laranja) */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0805] via-[#0d0805]/60 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_15%_85%,rgb(var(--c-accent)/0.35),transparent_70%)]" />
            <div className="absolute inset-x-0 bottom-0 p-5 pb-10 sm:p-8 sm:pb-12">
              <h2 className={`max-w-xl font-display font-extrabold leading-[1.05] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] ${s.highlight ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"}`}><Title text={s.title} highlight={s.highlight} /></h2>
              {s.subtitle && <p className="mt-2 max-w-lg text-sm text-white/90 sm:text-base">{s.subtitle}</p>}
              {s.ctaText && s.href && <Link href={s.href} className="btn-glow mt-4 no-underline" tabIndex={k === i ? 0 : -1}>{s.ctaText}</Link>}
            </div>
          </div>
        ))}
        {n > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {slides.map((s, k) => (
              <button key={s.id} type="button" onClick={() => go(k)} aria-label={`Destaque ${k + 1} de ${n}`} aria-current={k === i} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-2 bg-white/50"}`} />
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-accent2">Histórias angolanas. <span className="text-accent">Criadores locais.</span> Entretenimento de qualidade.</p>
    </section>
  );
}
