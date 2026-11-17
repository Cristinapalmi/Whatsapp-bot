import Link from "next/link";
import type { Metadata } from "next";
import { artistLink } from "@config/brand";
import { db } from "@/lib/db";
import { requireArtist, artistStats } from "@/lib/artist";
import { formatKz } from "@/lib/money";
import { getArtistWallet } from "@/domain/money/ledger";
import { LiveWallet } from "@/components/LiveWallet";
import { CopyButton } from "@/components/CopyButton";
import { IconChart, IconChevronRight, IconClock, IconFilm, IconWallet } from "@/components/icons";

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

  const [wallet, stats, series] = await Promise.all([
    getArtistWallet(db, artist.id),
    artistStats(artist.id),
    db.series.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const link = artistLink(artist.slug);

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
        <p className="mt-2 text-xs text-muted">Em breve: "Vieram por ti" — quantos fãs chegaram pelo teu link.</p>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">As minhas séries</h2>
          <Link href="/artista/series/nova" className="btn-secondary btn-sm"><IconFilm size={18} /> Enviar nova série</Link>
        </div>
        {series.length === 0 && <p className="mt-2 text-sm text-muted">Ainda não enviaste séries.</p>}
        <ul className="mt-2 space-y-2">
          {series.map((s) => (
            <li key={s.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-xs text-muted">{s.plannedEpisodes} episódios · {s.freeEpisodes} grátis · {formatKz(s.priceCents)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={SERIES_STATUS[s.status][1]}>{SERIES_STATUS[s.status][0]}</span>
                {s.status === "PUBLISHED" && <Link href={`/serie/${s.slug}`} aria-label="Ver série" className="btn-ghost btn-sm"><IconChevronRight size={18} /></Link>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted"><IconChart size={16} /> Ranking "Disputa dos artistas" chega na próxima fase.</p>
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
