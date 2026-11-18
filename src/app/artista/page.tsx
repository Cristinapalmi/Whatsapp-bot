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
import { ArtistGrowth } from "./ArtistGrowth";
import { artistMoneySnapshot, artistShareFor, earningsHistory, seriesAudience, topSpenders } from "@/domain/artists/growth";
import { artistLevel, recentActivity, seriesTodayCents, starterChecklist } from "@/domain/artists/dashboard";
import { weeklyPosition } from "@/domain/creator-ranking";
import { StatusHeader } from "./painel/StatusHeader";
import { ActivityFeed, FansRow, QuickActions, RankingCard, SeriesCards, StarterChecklist } from "./painel/Widgets";
import { releaseDuePending } from "@/domain/money/ledger";
import { ArtistMoneyPanel } from "@/components/ArtistMoneyPanel";
import { EarningsChart } from "@/components/EarningsChart";
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

export default async function ArtistDashboard({ searchParams }: { searchParams: Promise<{ apagada?: string }> }) {
  const sp = await searchParams;
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

  await releaseDuePending(db, { artistId: artist.id });
  const [stats, series, payouts, money, days, weeks, share, level, rank, activity, bigFans, todayBySeries, audienceList, checklist] = await Promise.all([
    artistStats(artist.id),
    db.series.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { episodes: true } } } }),
    db.payoutRequest.findMany({ where: { artistId: artist.id }, orderBy: { requestedAt: "desc" }, take: 3 }),
    artistMoneySnapshot(db, artist.id),
    earningsHistory(db, artist.id, "day"),
    earningsHistory(db, artist.id, "week"),
    artistShareFor(db, artist),
    artistLevel(db, artist.id),
    weeklyPosition(db, artist.id),
    recentActivity(db, artist.id, 8),
    topSpenders(db, artist.id, 10),
    seriesTodayCents(db, artist.id),
    seriesAudience(db, artist.id),
    starterChecklist(db, artist),
  ]);
  const link = artistLink(artist.slug);
  const history = {
    days: days.map((d) => ({ start: d.start.toISOString(), cents: d.cents })),
    weeks: weeks.map((d) => ({ start: d.start.toISOString(), cents: d.cents })),
  };
  const published = series.filter((s) => s.status === "PUBLISHED");
  const editable = series.find((s) => s.status !== "HIDDEN");
  const newEpisodeHref = editable ? `/artista/series/${editable.id}#novo-episodio` : "/artista/series/nova";
  const kitHref = published[0] ? `/artista/series/${published[0].id}#kit` : null;
  const isNew = checklist.percent < 100 && money.totalCents === 0;
  const audience = new Map(audienceList.map((x) => [x.id, x.viewers]));
  // ajusta o destino de "Conseguir o 1.º fã" para o kit da série publicada
  const tasks = checklist.tasks.map((t) => (t.key === "fa" ? { ...t, href: kitHref ?? newEpisodeHref } : t));

  return (
    <div className="container-app max-w-3xl">
      {sp.apagada && <p role="status" className="mb-3 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">Série apagada.</p>}
      <StatusHeader artist={artist} level={level} crowned={series.some((s) => s.crownedAt)} />

      {isNew && <StarterChecklist tasks={tasks} percent={checklist.percent} />}

      <ArtistMoneyPanel initial={money} last7={history.days.slice(-7).map((d) => d.cents)} />
      <QuickActions newEpisodeHref={newEpisodeHref} kitHref={kitHref} />
      <RankingCard position={rank.position} previous={rank.previous} total={rank.total} />
      <ActivityFeed items={activity} />
      <FansRow fans={bigFans} artistName={artist.stageName} link={`https://${link}`} />

      {/* As tuas séries */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">As tuas séries</h2>
          <Link href="/artista/series/nova" className="btn-secondary btn-sm no-underline"><IconFilm size={18} /> Nova série</Link>
        </div>
        {series.length === 0 ? (
          <EmptyState icon={<IconFilm size={24} />} title="Publica a tua primeira série" text="Cria a série, carrega os episódios e envia para revisão. Avisamos-te quando estiver publicada." action={{ href: "/artista/series/nova", label: "Criar a minha primeira série" }} />
        ) : (
          <SeriesCards series={series} today={todayBySeries} audience={audience} />
        )}
      </section>

      <div className="mt-6"><EarningsChart days={history.days} weeks={history.weeks} /></div>
      <ArtistGrowth artist={artist} />

      {/* Números */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<IconPlay size={16} />} label="Visualizações" value={stats.views} />
        <Stat icon={<IconFilm size={16} />} label="Episódios vendidos" value={stats.sales} />
        <Stat icon={<IconGift size={16} />} label="Presentes" value={stats.gifts} />
        <Stat icon={<IconClock size={16} />} label="Minutos vistos" value={stats.minutes} />
      </section>
      {stats.adUnlocks > 0 && <p className="mt-2 text-xs text-muted">{stats.adUnlocks} episódios teus desbloqueados com anúncio · ganhaste {formatKz(stats.adsEarnedCents)} com anúncios (entra uma vez por mês).</p>}

      {/* Link pessoal */}
      <section className="card mt-6 scroll-mt-20" id="link">
        <p className="flex items-center gap-2 font-semibold"><IconLink size={18} /> O teu link pessoal</p>
        <p className="text-sm text-muted">Põe na bio do TikTok e do Instagram.</p>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface2 px-4 py-2">
          <span className="truncate font-semibold text-accent2">{link}</span>
          <CopyButton text={`https://${link}`} label="Copiar link" showText />
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Vejam as minhas séries na ${brand.name} — os primeiros episódios são grátis 👉 https://${link}`)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-2 no-underline">Partilhar no WhatsApp</a>
        <h3 className="mt-4 text-sm font-semibold">Vieram por ti</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.visits}</p><p className="text-xs text-muted">visitas</p></div>
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.signups}</p><p className="text-xs text-muted">criaram conta</p></div>
          <div className="rounded-xl bg-surface2 p-3"><p className="font-display text-2xl font-bold">{stats.referral.payers}</p><p className="text-xs text-muted">já apoiaram</p></div>
        </div>
      </section>

      {/* Levantamentos */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Levantamentos</h2>
          <Link href="/artista/carteira" className="text-sm font-semibold text-accent2 underline">Ver tudo</Link>
        </div>
        {payouts.length === 0 ? (
          <EmptyState icon={<IconWallet size={24} />} title="Ainda não pediste levantamentos" text="Quando o teu saldo disponível chegar ao mínimo, levantas para o teu IBAN ou Multicaixa Express." action={{ href: "/artista/carteira", label: "Ligar a minha conta" }} />
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

      <p className="mt-6 flex items-center gap-2 text-xs text-muted"><IconChart size={16} /> Ganhas {share}% do valor das moedas que os fãs gastam nas tuas séries e nos presentes que te oferecem.</p>
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
