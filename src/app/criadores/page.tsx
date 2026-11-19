import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { formatKz, kzLabel } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth";
import { tierPrices } from "@/domain/coins/service";
import { foundersLeft, totalPaidToArtists } from "@/domain/artists/growth";
import { getInts } from "@/domain/settings";
import { EarningsCalculator } from "@/components/EarningsCalculator";

export const metadata: Metadata = { title: "Criadores", description: "Publica as tuas minisséries na KONTA e ganha com cada episódio desbloqueado." };
export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const user = await getCurrentUser();
  const isArtist = user ? !!(await db.artistProfile.findUnique({ where: { userId: user.id }, select: { id: true } })) : false;
  const [paid, founders, prices, cheapest, c] = await Promise.all([
    totalPaidToArtists(db),
    foundersLeft(db),
    tierPrices(db),
    db.coinPack.findFirst({ where: { active: true }, orderBy: { priceKz: "asc" } }),
    getInts(db, ["founderMonths", "founderSharePercent", "payoutFirstMinKz", "pendingDays"]),
  ]);
  const coinKz = cheapest ? cheapest.priceKz / cheapest.coins : 10;
  const cta = isArtist ? { href: "/artista", label: "Ir para o meu painel" } : { href: "/artista/registar", label: "QUERO GANHAR DINHEIRO" };

  return (
    <div className="container-app max-w-2xl">
      <section className="glow-gold rounded-3xl border border-accent2/30 bg-[radial-gradient(90%_100%_at_100%_0%,rgb(var(--c-accent)/0.35),transparent_60%),linear-gradient(150deg,#26170c,#120b06)] p-6">
        <span className="rounded-full bg-accent2/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-accent2">KONTA | Para criadores</span>
        <h1 className="mt-3 font-hero text-3xl font-black uppercase leading-tight sm:text-4xl">Criador, está na hora de <span className="text-accent2">ganhares mais!</span></h1>
        <p className="mt-2 text-lg font-bold text-fg">As tuas séries podem pôr mais dinheiro no teu bolso.</p>
        <p className="mt-2 text-fg/85">Publica as tuas minisséries na KONTA e ganha dinheiro com cada episódio desbloqueado pelos teus fãs. Não dependas só das publis. Cria as tuas próprias fontes de rendimento!</p>
        <Link href={cta.href} className="btn-glow mt-4 rounded-full font-extrabold no-underline">{cta.label}</Link>
        <p className="mt-3 text-sm font-bold text-accent">Entra gratuitamente. Publica as tuas séries. Ganha em kwanzas.</p>
      </section>

      {/* Três destaques */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card-warm glow-accent p-4">
          <p className="text-2xl" aria-hidden>⭐</p>
          <p className="mt-1 text-sm font-bold text-fg">Artistas Fundadores ganham mais nos primeiros {c.founderMonths} meses</p>
          <p className="mt-2 inline-block rounded-full bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent">{founders.left > 0 ? `Restam ${founders.left} de ${founders.limit} vagas` : "Vagas esgotadas"}</p>
        </div>
        <div className="card-warm p-4">
          <p className="font-hero text-3xl font-black text-accent2">{kzLabel(c.payoutFirstMinKz)}</p>
          <p className="mt-1 text-sm font-bold text-fg">Levantamento a partir de {kzLabel(c.payoutFirstMinKz)}</p>
          <p className="mt-1 text-xs text-muted">Por Multicaixa Express ou IBAN.</p>
        </div>
        <div className="card-warm p-4">
          <p className="font-hero text-3xl font-black text-accent2">0 Kz</p>
          <p className="mt-1 text-sm font-bold text-fg">Sem pagar para entrar</p>
          <p className="mt-1 text-xs text-muted">Nada de pacotes, níveis ou taxas de inscrição.</p>
        </div>
      </section>

      <section className="mt-6 card text-center">
        <p className="text-xs text-muted">A {brand.name} já pagou aos criadores</p>
        <p className="font-display text-2xl font-extrabold text-ok">{paid > 0 ? formatKz(paid) : "—"}</p>
        {paid === 0 && <p className="text-[11px] text-muted">Os primeiros pagamentos vão aparecer aqui.</p>}
      </section>

      <h2 className="mt-8 text-xl font-bold">Como funciona</h2>
      <ol className="mt-3 space-y-3">
        {[
          ["Publica", "Cria a tua série na app e carrega os episódios (vídeos verticais). A equipa revê e publica."],
          ["Conquista", "Os fãs veem os 3 primeiros episódios grátis. Partilha o teu link e o kit de promoção nas redes."],
          ["Monetiza", `Cada episódio desbloqueado entra na tua carteira. Levantas a partir de ${kzLabel(c.payoutFirstMinKz)}, por Multicaixa Express ou IBAN.`],
        ].map(([t, d], i) => (
          <li key={t} className="card flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-display font-extrabold text-[#1A0E05]">{i + 1}</span>
            <div><p className="font-bold">{t}</p><p className="text-sm text-muted">{d}</p></div>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-xl font-bold">Quanto posso ganhar?</h2>
      <div className="mt-3">
        <EarningsCalculator prices={prices} coinKz={coinKz} share={business.artistSharePercent} founderShare={founders.left > 0 ? c.founderSharePercent : null} />
      </div>

      <h2 className="mt-8 text-xl font-bold">Perguntas frequentes</h2>
      <div className="mt-3 space-y-2">
        {[
          ["É grátis?", `Sim. Registar-te e publicar na ${brand.name} não custa nada. Só ganhas — nunca pagas.`],
          ["Os vídeos continuam meus?", "Sim. As séries continuam a ser tuas e podes continuar a publicá-las onde quiseres. Podes retirar uma série quando quiseres."],
          ["Quando e como recebo?", `Cada ganho aparece logo na tua carteira e fica disponível ${c.pendingDays} dias depois. Pedes o levantamento para o teu Multicaixa Express ou IBAN (a partir de ${kzLabel(c.payoutFirstMinKz)}) e tentamos pagar em 24 horas.`],
          ["Isto não é esquema?", `Não. Não pedimos dinheiro a ninguém e não prometemos ganhos fixos: ganhas quando o público paga para ver as tuas séries. Tudo fica registado na tua carteira, movimento a movimento, e as regras estão escritas na Política do Artista.`],
        ].map(([q, a]) => (
          <details key={q} className="card">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-fg/90">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 text-sm"><Link href="/legal/politica-artista" className="text-accent2 underline">Ler a Política do Artista</Link></p>

      <div className="mt-8 text-center"><Link href={cta.href} className="btn-primary no-underline">{cta.label}</Link></div>
    </div>
  );
}
