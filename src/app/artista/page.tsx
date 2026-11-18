import Link from "next/link";
import type { Metadata } from "next";
import { artistLink } from "@config/brand";
import { db } from "@/lib/db";
import { requireArtist, artistStats } from "@/lib/artist";
import { formatKz } from "@/lib/money";
import { getArtistWallet } from "@/domain/money/ledger";
import { LiveWallet } from "@/components/LiveWallet";
import { CopyButton } from "@/components/CopyButton";
import { IconChart, IconChevronRight, IconClock, IconDownload, IconFilm, IconGift, IconLink, IconTrophy, IconWallet } from "@/components/icons";
import { topFans } from "@/domain/points";
import { getObjectUrl } from "@/domain/storage";
import { trailerCaption } from "@/domain/trailer";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { monthlyRanking, sortByRevenue, sortByViews } from "@/domain/ranking";

export const metadata: Metadata = { title: "Painel do artista" };
export const dynamic = "force-dynamic";

const SERIES_STATUS: Record<string, [string, string]> = {
  IN_REVIEW: ["Em análise", "badge-pending"],
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
          <div className="card mt-4">
            <p className="flex items-center gap-2 font-semibold text-warn"><IconClock size={20} /> Registo em análise</p>
            <p className="mt-2 text-sm text-muted">A nossa equipa vai verificar os teus dados e o teu perfil. Recebes uma notificação quando a conta estiver ativa.</p>
          </div>
        )}
        {artist.status === "REJECTED" && (
          <div className="card mt-4">
            <p className="font-semibold text-danger">Registo não aprovado</p>
            {artist.rejectionReason && <p className="mt-2 text-sm">Motivo: {artist.rejectionReason}</p>}
          </div>
        )}
        {artist.status === "SUSPENDED" && <div className="card mt-4 text-danger">Conta suspensa. Contacta o apoio.</div>}
      </div>
    );
  }

  const [wallet, stats, series, fans, ranking] = await Promise.all([
    getArtistWallet(db, artist.id),
    artistStats(artist.id),
    db.series.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" } }),
    topFans(db, artist.id, 3),
    monthlyRanking(db),
  ]);
  const posViews = sortByViews(ranking).findIndex((r) => r.artistId === artist.id) + 1;
  const posRevenue = sortByRevenue(ranking).findIndex((r) => r.artistId === artist.id) + 1;
  const link = artistLink(artist.slug);
  const trailers = await Promise.all(
    series.map(async (s) => (s.trailerKey ? getObjectUrl("media", s.trailerKey, 6 * 3600, { downloadName: `trailer-${s.slug}.mp4` }) : null)),
  );

  return (
    <div className="container-app max-w-3xl">
      <h1 className="text-2xl font-bold">Olá, {artist.stageName}</h1>

      <section className="card mt-4">
        <p className="flex items-center gap-2 text-sm text-muted"><IconWallet size={18} /> Saldo disponível</p>
        <LiveWallet initialCents={wallet.availableCents} />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div><p className="text-muted">Ganho este mês</p><p className="font-semibold">{formatKz(wallet.earnedThisMonthCents)}</p></div>
          <div><p className="text-muted">Total ganho</p><p className="font-semibold">{formatKz(wallet.earnedTotalCents)}</p></div>
          <div><p className="text-muted">Em levantamento</p><p className="font-semibold">{formatKz(wallet.processingCents)}</p></div>
        </div>
        <Link href="/artista/carteira" className="btn-primary mt-4 w-full sm:w-auto">Carteira e levantamentos</Link>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Visualizações" value={stats.views} />
        <Stat label="Vistos até ao fim" value={stats.completions} />
        <Stat label="Episódios vendidos" value={stats.sales} />
        <Stat label="Minutos vistos" value={stats.minutes} />
      </section>

      <section className="card mt-4">
        <p className="text-sm text-muted">O teu link pessoal — põe na bio do TikTok e do Instagram</p>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface2 px-4 py-2">
          <span className="truncate font-semibold text-accent2">{link}</span>
          <CopyButton text={`https://${link}`} label="Copiar link" showText />
        </div>
        <h3 className="mt-4 flex items-center gap-2 font-semibold"><IconLink size={18} /> Vieram por ti</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.visits}</p><p className="text-xs text-muted">visitas ao link</p></div>
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.signups}</p><p className="text-xs text-muted">criaram conta</p></div>
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.payers}</p><p className="text-xs text-muted">já pagaram</p></div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="card">
          <p className="flex items-center gap-2 text-sm text-muted"><IconTrophy size={18} /> Disputa dos artistas (este mês)</p>
          <p className="mt-1"><span className="font-display text-2xl font-bold text-accent">{posViews}.º</span> <span className="text-sm text-muted">em visualizações</span></p>
          <p><span className="font-display text-2xl font-bold text-accent">{posRevenue}.º</span> <span className="text-sm text-muted">em apoio do público</span></p>
          <Link href="/ranking" className="mt-2 inline-block text-sm text-accent2 underline">Ver ranking</Link>
        </div>
        <div className="card">
          <p className="flex items-center gap-2 text-sm text-muted"><IconGift size={18} /> Presentes recebidos</p>
          <p className="mt-1 font-display text-2xl font-bold">{stats.gifts}</p>
          <p className="text-sm text-muted">no valor de {formatKz(stats.giftsCents)} (ganhas {business.artistSharePercent}%)</p>
          {fans.length > 0 && (
            <p className="mt-2 text-sm">Fã n.º 1: <strong className="text-accent2">{fans[0].displayName}</strong> ({fans[0].points} pontos)</p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">As minhas séries</h2>
          <Link href="/artista/series/nova" className="btn-secondary btn-sm"><IconFilm size={18} /> Enviar nova série</Link>
        </div>
        {series.length === 0 && <p className="mt-2 text-sm text-muted">Ainda não enviaste séries.</p>}
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
                  {s.status === "PUBLISHED" && <Link href={`/serie/${s.slug}`} aria-label="Ver série" className="btn-ghost btn-sm"><IconChevronRight size={18} /></Link>}
                </div>
              </div>
              {trailers[i] && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                  <a href={trailers[i]!} className="btn-primary btn-sm no-underline" download><IconDownload size={18} /> Descarregar trailer</a>
                  <CopyButton text={trailerCaption({ title: s.title, brand: brand.name, link: link })} label="Copiar legenda para o TikTok" showText buttonText="Copiar legenda" />
                  <span className="w-full text-xs text-muted">Publica o trailer no TikTok/Instagram com o teu link na bio. Quem vier pelo link conta em "Vieram por ti".</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted"><IconChart size={16} /> A tua parte do passe semanal é creditada à segunda-feira, conforme o tempo que o público com passe viu as tuas séries.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl font-bold">{value.toLocaleString("pt-AO")}</p>
    </div>
  );
}
