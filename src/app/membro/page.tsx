import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { IconCoin, IconCrown, IconDownload, IconFilm, IconSparkle, IconStar } from "@/components/icons";

export const metadata: Metadata = { title: "Membro" };

const PLANS = [
  { name: "Semanal", note: "Para experimentar" },
  { name: "Mensal", note: "O mais escolhido" },
  { name: "Anual", note: "O melhor preço" },
];

const BENEFITS = [
  { icon: IconFilm, text: "Todos os episódios de todas as séries" },
  { icon: IconSparkle, text: "Séries exclusivas para membros" },
  { icon: IconStar, text: "Pontos de fã extra todos os dias" },
  { icon: IconDownload, text: "Ver em melhor qualidade" },
];

export default function MemberPage() {
  return (
    <div className="container-app max-w-2xl">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-accent/40 via-surface to-bg p-6">
        <span className="badge-price"><IconCrown size={14} /> {brand.name} Membro</span>
        <h1 className="mt-3 text-3xl font-extrabold">Sê membro</h1>
        <p className="mt-1 text-fg/85">Os planos de membro estão quase prontos. Até lá, desbloqueia os episódios que quiseres com moedas.</p>
      </section>

      <ul className="mt-5 space-y-3">
        {PLANS.map((p) => (
          <li key={p.name} className="relative flex items-center justify-between rounded-2xl border border-white/10 bg-surface p-5 opacity-80">
            <div>
              <p className="text-lg font-bold">Plano {p.name}</p>
              <p className="text-sm text-muted">{p.note}</p>
            </div>
            <span className="badge-muted text-sm">Brevemente</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-xl font-bold">Porquê ser membro?</h2>
      <ul className="mt-3 space-y-3">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-fg/90">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-accent2"><Icon size={20} /></span>
            {text}
          </li>
        ))}
      </ul>

      <div className="card mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Queres continuar a ver já? Compra moedas e desbloqueia episódio a episódio.</p>
        <Link href="/loja" className="btn-primary no-underline"><IconCoin size={18} /> Ir à Loja</Link>
      </div>
    </div>
  );
}
