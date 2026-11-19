import { mediaUrl } from "@/lib/media";
import { IconStar } from "@/components/icons";
import { formatDate } from "@/lib/dates";

const TIER: Record<string, string> = { ENTRY: "Entrada", NORMAL: "Normal ⭐", PREMIUM: "Premium 💎" };

/** Topo com estatuto: foto com anel de progresso para o próximo nível, nome e selos. */
export async function StatusHeader({ artist, level, crowned, share }: {
  artist: { stageName: string; photoKey: string | null; founderNumber: number | null; verifiedAt: Date | null };
  level: { tier: null | "ENTRY" | "NORMAL" | "PREMIUM"; progress: number; now: number; target: number };
  crowned: boolean;
  /** Até quando o bónus de Fundador está ativo (null = sem bónus). */
  share: { founderUntil: Date | null; founderPercent: number };
}) {
  const photo = await mediaUrl(artist.photoKey);
  const R = 46;
  const C = 2 * Math.PI * R;
  const pct = level.tier ? level.progress : 0;
  return (
    <section className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="5" className="text-white/10" />
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="5" strokeLinecap="round" stroke="url(#ring)" strokeDasharray={`${C * pct} ${C}`} className="transition-[stroke-dasharray] duration-1000" />
          <defs><linearGradient id="ring" x1="0" x2="1"><stop offset="0" stopColor="rgb(var(--c-accent))" /><stop offset="1" stopColor="rgb(var(--c-accent2))" /></linearGradient></defs>
        </svg>
        <div className="absolute inset-[9px] overflow-hidden rounded-full bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-3xl font-bold text-accent">{artist.stageName[0]}</span>}
        </div>
        {crowned && <span className="absolute -right-1 -top-1 text-2xl" aria-label="Série coroada">👑</span>}
      </div>
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-extrabold">{artist.stageName}</h1>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {artist.founderNumber && <span className="badge-free"><IconStar size={12} /> Fundador n.º {artist.founderNumber}</span>}
          {artist.verifiedAt && <span className="badge-unlocked">✓ Verificado</span>}
          {level.tier && <span className="badge-price">Nível {TIER[level.tier]}</span>}
          {share.founderUntil && <span className="badge-unlocked">Bónus de Fundador ativo: {share.founderPercent}% até {formatDate(share.founderUntil)}</span>}
        </div>
        <p className="mt-1 text-xs text-muted">
          {!level.tier
            ? "Publica a tua primeira série para começares a subir de nível."
            : level.tier === "ENTRY"
              ? `${level.now.toLocaleString("pt-AO")} de ${level.target.toLocaleString("pt-AO")} desbloqueios pagos para subir a Normal ⭐`
              : level.tier === "NORMAL"
                ? "Nível Normal ⭐. O Premium 💎 é dado pela equipa às séries de maior sucesso."
                : "Nível máximo: Premium 💎"}
        </p>
      </div>
    </section>
  );
}
