import Link from "next/link";
import { formatKz } from "@/lib/money";
import { mediaUrl } from "@/lib/media";
import { IconChevronRight, IconDownload, IconFilm, IconTrophy, IconWallet } from "@/components/icons";
import { ThankFansButton } from "./ThankFansButton";

export function timeAgo(d: Date, now = new Date()) {
  const m = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

export function QuickActions({ newEpisodeHref, kitHref }: { newEpisodeHref: string; kitHref: string | null }) {
  const cls = "flex flex-col items-center gap-1 rounded-2xl bg-surface p-3 text-center text-xs font-semibold text-fg no-underline hover:bg-surface2";
  return (
    <section className="mt-3 grid grid-cols-3 gap-2" aria-label="Ações rápidas">
      <Link href={newEpisodeHref} className={cls}><IconFilm size={22} className="text-accent" /> Novo episódio</Link>
      {kitHref ? <Link href={kitHref} className={cls}><IconDownload size={22} className="text-accent2" /> Partilhar o meu kit</Link> : <span className={`${cls} opacity-50`} title="Disponível quando tiveres uma série publicada"><IconDownload size={22} /> Partilhar o meu kit</span>}
      <Link href="/artista/carteira#levantar" className={cls}><IconWallet size={22} className="text-ok" /> Levantar</Link>
    </section>
  );
}

export function RankingCard({ position, previous, total }: { position: number | null; previous: number | null; total: number }) {
  const moved = position && previous ? previous - position : 0;
  return (
    <section className="card mt-3 flex items-center gap-4">
      <IconTrophy size={32} className="shrink-0 text-accent2" />
      {position ? (
        <div>
          <p className="font-display text-xl font-extrabold">#{position} no ranking da KONTA esta semana</p>
          <p className="text-sm">
            {moved > 0 ? <span className="font-semibold text-ok">▲ Subiste {moved} {moved === 1 ? "lugar" : "lugares"}</span> : moved < 0 ? <span className="font-semibold text-warn">▼ Desceste {-moved} {moved === -1 ? "lugar" : "lugares"}</span> : previous ? <span className="text-muted">Mesmo lugar da semana passada</span> : <span className="text-muted">Entraste no ranking esta semana</span>}
            {position > 5 && <span className="text-muted"> · Faltam {position - 5} {position - 5 === 1 ? "lugar" : "lugares"} para o Top 5</span>}
            {position <= 5 && <span className="text-accent2"> · Estás no Top 5 🔥</span>}
          </p>
          <Link href="/ranking" className="text-xs text-accent2 underline">Ver ranking ({total} criadores)</Link>
        </div>
      ) : (
        <div>
          <p className="font-semibold">Ainda sem lugar no ranking desta semana</p>
          <p className="text-sm text-muted">Cada fã, desbloqueio e seguidor conta. Partilha o teu link!</p>
        </div>
      )}
    </section>
  );
}

export function ActivityFeed({ items }: { items: { id: string; at: Date; icon: string; text: string; cents: number }[] }) {
  return (
    <section className="card mt-3">
      <h2 className="flex items-center gap-2 font-bold"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok" /></span> Agora mesmo</h2>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Quando os fãs desbloquearem episódios, enviarem presentes ou te seguirem, aparece aqui.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="text-lg" aria-hidden>{a.icon}</span>
              <span className="min-w-0 flex-1"><span className="block">{a.text}</span><span className="text-xs text-muted">{timeAgo(a.at)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FansRow({ fans, artistName, link }: { fans: { userId: string; displayName: string; coins: number }[]; artistName: string; link: string }) {
  return (
    <section className="card mt-3">
      <h2 className="font-bold">Os teus maiores fãs</h2>
      {fans.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Os teus fãs mais fiéis vão aparecer aqui.</p>
      ) : (
        <>
          <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto pb-1">
            {fans.map((f, i) => (
              <div key={f.userId} className="flex w-14 shrink-0 flex-col items-center text-center">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full font-display text-lg font-bold ${i === 0 ? "bg-accent2 text-[#1A0E05]" : "bg-surface2 text-fg"}`}>{f.displayName[0]}</span>
                <span className="mt-1 line-clamp-1 text-[11px]">{f.displayName}</span>
                {i === 0 && <span className="text-[10px] text-accent2">👑 n.º 1</span>}
              </div>
            ))}
          </div>
          <ThankFansButton names={fans.slice(0, 5).map((f) => f.displayName)} artistName={artistName} link={link} />
        </>
      )}
    </section>
  );
}

export async function SeriesCards({ series, today, audience }: {
  series: { id: string; title: string; status: string; coverKey: string | null; _count: { episodes: number } }[];
  today: Map<string, number>;
  audience: Map<string, number>;
}) {
  const covers = await Promise.all(series.map((s) => mediaUrl(s.coverKey)));
  const STATUS: Record<string, [string, string]> = {
    DRAFT: ["Rascunho", "badge-muted"], IN_REVIEW: ["Em revisão", "badge-pending"], APPROVED: ["Aprovada", "badge-unlocked"],
    PUBLISHED: ["Publicada", "badge-free"], REJECTED: ["Recusada", "badge-danger"], HIDDEN: ["Retirada", "badge-muted"],
  };
  return (
    <ul className="mt-2 space-y-2">
      {series.map((s, i) => (
        <li key={s.id}>
          <Link href={`/artista/series/${s.id}`} className="card flex items-center gap-3 no-underline hover:bg-surface2">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-surface2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {covers[i] && <img src={covers[i]!} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-fg">{s.title}</p>
              <span className={`${STATUS[s.status][1]} mt-0.5`}>{STATUS[s.status][0]}</span>
              <p className="mt-1 text-xs text-muted">
                {s._count.episodes} ep. · {(audience.get(s.id) ?? 0).toLocaleString("pt-AO")} a acompanhar
                {s.status === "PUBLISHED" && (today.get(s.id) ?? 0) > 0 && <> · <span className="font-semibold text-ok">a render hoje 🔥</span></>}
              </p>
            </div>
            <IconChevronRight size={18} className="text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StarterChecklist({ tasks, percent }: { tasks: { key: string; label: string; done: boolean; href: string; cta: string }[]; percent: number }) {
  return (
    <section className="mt-4 rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/15 to-surface p-5">
      <p className="font-display text-lg font-extrabold">O teu perfil está {percent}% completo</p>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2" style={{ width: `${Math.max(4, percent)}%` }} /></div>
      <ul className="mt-3 space-y-2">
        {tasks.map((t) => (
          <li key={t.key} className="flex items-center justify-between gap-2 rounded-xl bg-surface/70 px-3 py-2 text-sm">
            <span className={t.done ? "text-ok" : ""}>{t.done ? "✓" : "○"} {t.label}</span>
            {!t.done && <Link href={t.href} className="btn-primary btn-sm shrink-0 no-underline">{t.cta}</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}
