import Link from "next/link";
import type { Metadata } from "next";
import { artistLink, brand } from "@config/brand";
import { db } from "@/lib/db";
import { requireArtist, artistStats } from "@/lib/artist";
import { formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { getArtistWallet } from "@/domain/money/ledger";
import { topFans } from "@/domain/points";
import { getObjectUrl } from "@/domain/storage";
import { trailerCaption } from "@/domain/trailer";
import { monthlyRanking, sortByRevenue, sortByViews } from "@/domain/ranking";
import { LiveWallet } from "@/components/LiveWallet";
import { CopyButton } from "@/components/CopyButton";
import { EmptyState } from "@/components/EmptyState";
import { PayoutStatusBadge } from "@/components/StatusBadge";
import {
  IconChart, IconChevronRight, IconClock, IconDownload, IconFilm, IconGift, IconLink, IconPlay, IconTrophy, IconWallet,
} from "@/components/icons";

export const metadata: Metadata = { title: "Painel do artista" };
export const dynamic = "force-dynamic";

const SERIES_STATUS: Record<string, [string, string]> = {
  DRAFT: ["Rascunho", "badge-muted"],
  IN_REVIEW: ["Enviada para revisão", "badge-pending"],
  APPROVED: ["Aprovada", "badge-unlocked"],
  PUBLISHED: ["Publicada", "badge-free"],
  REJECTED: ["Rejeitada", "badge-danger"],
  HIDDEN: ["Retirada", "badge-muted"],
};

export default async function ArtistDashboard() {
  const { artist } = await requireArtist();

  if (artist.status !== "APPROVED") {
    return (
      <div className="container-app max-w-xl py-8">
        <h1 className="text-2xl font-bold">Olá, {artist.stageName}</h1>
        {artist.status === "PENDING" && (
          <EmptyState
            icon={<IconClock size={24} />}
            title="O teu registo está em análise"
            text="Vamos verificar os teus dados e o teu perfil. Recebes uma notificação assim que a conta estiver ativa — normalmente em poucos dias."
            action={{ href: "/legal/politica-artista", label: "Ver o que ganhas com a " + brand.name }}
          />
        )}
        {artist.status === "REJECTED" && (
          <div className="card mt-4">
            <p className="font-semibold text-danger">Registo não aprovado</p>
            {artist.rejectionReason && <p className="mt-2 text-sm">Motivo: {artist.rejectionReason}</p>}
            <p className="mt-2 text-sm text-muted">Dúvidas? Fala connosco: {brand.supportWhatsapp}</p>
          </div>
        )}
        {artist.status === "SUSPENDED" && <div className="card mt-4 text-danger">Conta suspensa. Contacta o apoio: {brand.supportWhatsapp}</div>}
      </div>
    );
  }

  const [wallet, stats, series, fans, ranking, payouts] = await Promise.all([
    getArtistWallet(db, artist.id),
    artistStats(artist.id),
    db.series.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" } }),
    topFans(db, artist.id, 3),
    monthlyRanking(db),
    db.payoutRequest.findMany({ where: { artistId: artist.id }, orderBy: { requestedAt: "desc" }, take: 3 }),
  ]);
  const posViews = sortByViews(ranking).findIndex((r) => r.artistId === artist.id) + 1;
  const posRevenue = sortByRevenue(ranking).findIndex((r) => r.artistId === artist.id) + 1;
  const link = artistLink(artist.slug);
  const trailers = await Promise.all(
    series.map(async (s) => (s.trailerKey ? getObjectUrl("media", s.trailerKey, 6 * 3600, { downloadName: `trailer-${s.slug}.mp4` }) : null)),
  );
  const hasPublished = series.some((s) => s.status === "PUBLISHED");

  return (
    <div className="container-app max-w-3xl">
      <h1 className="text-2xl font-bold">Olá, {artist.stageName}</h1>
      <p className="text-sm text-muted">Quanto mais assistirem às tuas séries, mais ganhas.</p>

      {/* Carteira */}
      <section className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-accent/25 via-surface to-surface p-5">
        <p className="flex items-center gap-2 text-sm text-muted"><IconWallet size={18} /> Saldo disponível</p>
        <LiveWallet initialCents={wallet.availableCents} />
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-muted">Este mês</p><p className="font-semibold">{formatKz(wallet.earnedThisMonthCents)}</p></div>
          <div><p className="text-muted">Total ganho</p><p className="font-semibold">{formatKz(wallet.earnedTotalCents)}</p></div>
          <div><p className="text-muted">A levantar</p><p className="font-semibold">{formatKz(wallet.processingCents)}</p></div>
        </div>
        <Link href="/artista/carteira" className="btn-primary mt-4 w-full no-underline sm:w-auto">Carteira e levantamentos</Link>
      </section>

      {/* Números */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<IconPlay size={16} />} label="Visualizações" value={stats.views} />
        <Stat icon={<IconFilm size={16} />} label="Episódios vendidos" value={stats.sales} />
        <Stat icon={<IconGift size={16} />} label="Presentes" value={stats.gifts} />
        <Stat icon={<IconClock size={16} />} label="Minutos vistos" value={stats.minutes} />
      </section>

      <section className="card mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-muted"><IconPlay size={16} /> Episódios vistos com anúncio</p>
          <p className="font-display text-2xl font-bold">{stats.adUnlocks.toLocaleString("pt-AO")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Ganhaste com anúncios</p>
          <p className="font-display text-2xl font-bold text-ok">{formatKz(stats.adsEarnedCents)}</p>
        </div>
      </section>
      <p className="mt-1 text-xs text-muted">Os ganhos com anúncios entram uma vez por mês, conforme os episódios teus desbloqueados com anúncio nesse mês.</p>

      {/* Últimas vendas */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">Últimos ganhos</h2>
        {stats.recentSales.length === 0 ? (
          <EmptyState
            icon={<IconWallet size={24} />}
            title="Os teus primeiros ganhos vão aparecer aqui"
            text={hasPublished ? "Partilha o teu link pessoal e o trailer nas redes: cada episódio desbloqueado e cada presente entram logo na tua carteira." : "Assim que a tua primeira série estiver publicada, cada episódio desbloqueado entra aqui."}
            action={hasPublished ? undefined : { href: "/artista/series/nova", label: "Publica a tua primeira série" }}
          />
        ) : (
          <ul className="mt-2 divide-y divide-white/5 rounded-2xl bg-surface px-4">
            {stats.recentSales.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div><p>{s.text}</p><p className="text-xs text-muted">{formatDateTime(s.date)}</p></div>
                <span className="font-semibold text-ok">+{formatKz(s.earnedCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Link pessoal */}
      <section className="card mt-6">
        <p className="flex items-center gap-2 font-semibold"><IconLink size={18} /> O teu link pessoal</p>
        <p className="text-sm text-muted">Põe na bio do TikTok e do Instagram.</p>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface2 px-4 py-2">
          <span className="truncate font-semibold text-accent2">{link}</span>
          <CopyButton text={`https://${link}`} label="Copiar link" showText />
        </div>
        <h3 className="mt-4 text-sm font-semibold">Vieram por ti</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.visits}</p><p className="text-xs text-muted">visitas</p></div>
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.signups}</p><p className="text-xs text-muted">criaram conta</p></div>
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.payers}</p><p className="text-xs text-muted">já apoiaram</p></div>
        </div>
      </section>

      {/* Ranking, presentes, fãs */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="card">
          <p className="flex items-center gap-2 text-sm text-muted"><IconTrophy size={18} /> Disputa dos artistas (este mês)</p>
          {posViews > 0 && stats.views > 0 ? (
            <>
              <p className="mt-1"><span className="font-display text-2xl font-bold text-accent">{posViews}.º</span> <span className="text-sm text-muted">em visualizações</span></p>
              <p><span className="font-display text-2xl font-bold text-accent">{posRevenue}.º</span> <span className="text-sm text-muted">em apoio do público</span></p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Ainda não entraste no ranking deste mês. Cada visualização conta!</p>
          )}
          <Link href="/ranking" className="mt-2 inline-block text-sm text-accent2 underline">Ver ranking</Link>
        </div>
        <div className="card">
          <p className="flex items-center gap-2 text-sm text-muted"><IconGift size={18} /> Presentes e fãs</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatKz(stats.giftsEarnedCents)}</p>
          <p className="text-sm text-muted">ganhaste com {stats.gifts} {stats.gifts === 1 ? "presente" : "presentes"}</p>
          {fans.length > 0 ? (
            <p className="mt-2 text-sm">Fã n.º 1: <strong className="text-accent2">{fans[0].displayName}</strong> ({fans[0].points} pontos)</p>
          ) : (
            <p className="mt-2 text-sm text-muted">O teu Fã n.º 1 aparece aqui quando os fãs virem os teus episódios até ao fim.</p>
          )}
        </div>
      </section>

      {/* Séries */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">As minhas séries</h2>
          <Link href="/artista/series/nova" className="btn-secondary btn-sm no-underline"><IconFilm size={18} /> Enviar nova série</Link>
        </div>
        {series.length === 0 ? (
          <EmptyState
            icon={<IconFilm size={24} />}
            title="Publica a tua primeira série"
            text="Envia o link da tua série no TikTok ou no Instagram. Nós tratamos do resto e avisamos-te quando estiver publicada."
            action={{ href: "/artista/series/nova", label: "Publica a tua primeira série" }}
          />
        ) : (
          <ul className="mt-2 space-y-2">
            {series.map((s, i) => (
              <li key={s.id} className="card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-xs text-muted">{s.plannedEpisodes} episódios · {s.freeEpisodes} grátis</p>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className={SERIES_STATUS[s.status][1]}>{SERIES_STATUS[s.status][0]}</span>
                    <Link href={`/artista/series/${s.id}`} aria-label="Gerir série" className="btn-ghost btn-sm"><IconChevronRight size={18} /></Link>
                  </div>
                </div>
                {trailers[i] && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                    <a href={trailers[i]!} className="btn-primary btn-sm no-underline" download><IconDownload size={18} /> Descarregar trailer</a>
                    <CopyButton text={trailerCaption({ title: s.title, brand: brand.name, link })} label="Copiar legenda para o TikTok" showText buttonText="Copiar legenda" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Levantamentos */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Levantamentos</h2>
          <Link href="/artista/carteira" className="text-sm font-semibold text-accent2 underline">Ver tudo</Link>
        </div>
        {payouts.length === 0 ? (
          <EmptyState icon={<IconWallet size={24} />} title="Ainda não pediste levantamentos" text="Quando o teu saldo chegar ao mínimo, levantas para o teu IBAN ou Multicaixa Express." action={{ href: "/artista/carteira", label: "Ligar a minha conta" }} />
        ) : (
          <ul className="mt-2 space-y-2">
            {payouts.map((p) => (
              <li key={p.id} className="card flex items-center justify-between gap-3">
                <div><p className="font-semibold">{formatKz(p.amountCents)}</p><p className="text-xs text-muted">{formatDateTime(p.requestedAt)}</p></div>
                <PayoutStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted"><IconChart size={16} /> Ganhas 50% do valor das moedas que os fãs gastam nas tuas séries e nos presentes que te oferecem.</p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card">
      <p className="flex items-center gap-1.5 text-xs text-muted">{icon} {label}</p>
      <p className="font-display text-2xl font-bold">{value.toLocaleString("pt-AO")}</p>
    </div>
  );
}
