import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { formatKz } from "@/lib/money";
import { RANK_METRICS, creatorRanking, monthRangeLuanda, monthlyKing, sortRanking, weekRange, type RankMetric } from "@/domain/creator-ranking";

export const metadata: Metadata = { title: "Ranking dos criadores" };
export const dynamic = "force-dynamic";

/** Ranking público dos criadores: semana ou mês, por fãs, desbloqueios ou seguidores. Nunca por dinheiro. */
export default async function RankingPage({ searchParams }: { searchParams: Promise<{ periodo?: string; por?: string }> }) {
  const { periodo, por } = await searchParams;
  const period = periodo === "mes" ? "mes" : "semana";
  const metric: RankMetric = RANK_METRICS.some((m) => m.key === por) ? (por as RankMetric) : "fans";
  const range = period === "mes" ? monthRangeLuanda() : weekRange();
  const [rows, king] = await Promise.all([creatorRanking(db, range), monthlyKing(db)]);
  const sorted = sortRanking(rows, metric).slice(0, 50);
  const photos = await Promise.all(sorted.map((r) => mediaUrl(r.photoKey)));
  const kingPhoto = king ? await mediaUrl(king.photoKey) : null;
  const q = (p: string, m: string) => `/ranking?periodo=${p}&por=${m}`;
  const label = { fans: "fãs", unlocks: "desbloqueios", followers: "novos seguidores" }[metric];
  const label1 = { fans: "fã", unlocks: "desbloqueio", followers: "novo seguidor" }[metric];
  const n = (v: number, one: string, many: string) => `${v.toLocaleString("pt-AO")} ${v === 1 ? one : many}`;

  return (
    <div className="container-app max-w-2xl">
      <h1 className="text-3xl font-bold">Ranking dos criadores</h1>
      <p className="mt-1 text-sm text-muted">Quem mais conquistou o público {period === "mes" ? "este mês" : "esta semana"}.</p>

      {king && (
        <Link href={`/${king.slug}`} className="mt-4 flex items-center gap-3 rounded-3xl border border-accent2/50 bg-gradient-to-r from-accent2/25 to-surface p-4 no-underline">
          <div className="relative h-16 w-16 shrink-0">
            <div className="h-full w-full overflow-hidden rounded-full bg-surface2 ring-2 ring-accent2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {kingPhoto ? <img src={kingPhoto} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-2xl font-bold text-accent2">{king.stageName[0]}</span>}
            </div>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl" aria-hidden>👑</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-accent2">Rei/Rainha da KONTA do mês passado</p>
            <p className="font-display text-xl font-extrabold text-fg">{king.stageName}</p>
            <p className="text-xs text-muted">{n(king.fans, "fã", "fãs")}</p>
          </div>
        </Link>
      )}

      <div className="mt-4 flex gap-2">
        {[["semana", "Esta semana"], ["mes", "Este mês"]].map(([k, l]) => (
          <Link key={k} href={q(k, metric)} className={`no-underline ${period === k ? "btn-primary btn-sm" : "btn-secondary btn-sm"}`}>{l}</Link>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {RANK_METRICS.map((m) => (
          <Link key={m.key} href={q(period, m.key)} className={`no-underline ${metric === m.key ? "btn-primary btn-sm" : "btn-ghost btn-sm border border-white/10"}`}>{m.label}</Link>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-white/15 bg-surface p-6 text-center text-sm text-muted">Ainda sem atividade neste período. O ranking enche-se quando os fãs começarem a ver, desbloquear e seguir os criadores.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {sorted.map((r, i) => (
            <li key={r.artistId}>
              <Link href={`/${r.slug}`} className={`card flex items-center gap-3 no-underline hover:bg-surface2 ${i < 3 ? "border border-accent2/30" : ""}`}>
                <span className={`w-7 shrink-0 text-center font-display text-xl font-extrabold ${i === 0 ? "text-accent2" : i < 3 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-surface2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photos[i] ? <img src={photos[i]!} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center font-bold text-accent">{r.stageName[0]}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">{r.stageName}{king?.artistId === r.artistId ? " 👑" : ""}{r.founderNumber ? <span className="ml-1 text-[11px] text-accent2">⭐ Fundador</span> : null}</p>
                  <p className="text-xs text-muted">{n(r.fans, "fã", "fãs")} · {n(r.unlocks, "desbloqueio", "desbloqueios")} · {n(r.followers, "seguidor", "seguidores")}</p>
                  {r.earnedCents !== null && r.earnedCents > 0 && <p className="text-xs text-ok">Ganhou {formatKz(r.earnedCents)} {period === "mes" ? "este mês" : "esta semana"}</p>}
                </div>
                <span className="shrink-0 text-right"><span className="block font-display text-lg font-bold text-fg">{r[metric].toLocaleString("pt-AO")}</span><span className="text-[10px] text-muted">{r[metric] === 1 ? label1 : label}</span></span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-muted">O ranking conta fãs (pessoas que viram), desbloqueios e novos seguidores — nunca dinheiro. Os ganhos só aparecem se o próprio criador escolher mostrá-los. A semana começa à segunda-feira.</p>
    </div>
  );
}
