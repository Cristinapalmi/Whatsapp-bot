import { siteUrl } from "@config/brand";
import { db } from "@/lib/db";
import { formatKz, kzToCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { episodePriceCoins, paidUnlocks, tierUpgradeUnlocks, TIER_LABELS } from "@/domain/coins/service";
import { artistShareFor, founderUntil, seriesAudience, topEpisodes, topSpenders } from "@/domain/artists/growth";
import { getInts } from "@/domain/settings";
import { CopyButton } from "@/components/CopyButton";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { IconCrown, IconStar, IconTrophy } from "@/components/icons";
import { saveArtistLinksAction, setNotifyEachUnlockAction } from "./actions";

type Artist = {
  id: string; slug: string; stageName: string; founderNumber: number | null; createdAt: Date; verifiedAt: Date | null;
  tiktokUrl: string | null; instagramUrl: string | null; bio: string | null; notifyEachUnlock: boolean;
};

/** Painel de crescimento do artista: hoje / mês / total, próximo objetivo, projeção, maiores fãs, convites. */
export async function ArtistGrowth({ artist }: { artist: Artist }) {
  const [topEps, audience, fans, cfg, series, share, upgradeAt, invited, cheapest, followers] = await Promise.all([
    topEpisodes(db, artist.id, 5),
    seriesAudience(db, artist.id),
    topSpenders(db, artist.id, 10),
    getInts(db, ["founderMonths", "tiktokViewsPerUnlock", "artistReferralBonusKz"]),
    db.series.findMany({ where: { artistId: artist.id, status: "PUBLISHED" }, include: { episodes: { where: { published: true }, select: { number: true } } } }),
    artistShareFor(db, artist),
    tierUpgradeUnlocks(db),
    db.artistProfile.findMany({ where: { invitedByArtistId: artist.id }, select: { stageName: true, referralBonusPaidAt: true } }),
    db.coinPack.findFirst({ where: { active: true }, orderBy: { priceKz: "asc" } }),
    db.follow.count({ where: { artistId: artist.id } }),
  ]);
  const unlocksBySeries = await Promise.all(series.map((s) => paidUnlocks(db, s.id)));
  const totalUnlocks = unlocksBySeries.reduce((a, b) => a + b, 0);
  // Série principal: a que tem mais desbloqueios
  const bestIdx = unlocksBySeries.reduce((best, n, i) => (n > unlocksBySeries[best] ? i : best), 0);
  const best = series[bestIdx];
  const bestUnlocks = unlocksBySeries[bestIdx] ?? 0;
  const coinKz = cheapest ? cheapest.priceKz / cheapest.coins : 10;
  let projection = 0;
  if (best) {
    const price = await episodePriceCoins(db, best);
    const paidEps = best.episodes.filter((e) => e.number > best.freeEpisodes).length;
    projection = Math.round(500 * paidEps * price * coinKz * (share / 100));
  }
  // Subida de nível da série principal (Entrada → Normal)
  const goal = best && best.tier === "ENTRY" ? { text: "Subir a Normal ⭐ (ganhas mais por episódio)", now: bestUnlocks, target: upgradeAt } : null;
  const inviteLink = `${siteUrl()}/artista/registar?convite=${artist.slug}`;
  const fUntil = artist.founderNumber ? founderUntil(artist.createdAt, cfg.founderMonths) : null;

  return (
    <>
      {/* Selos */}
      <div className="mt-2 flex flex-wrap gap-2">
        {artist.founderNumber && <span className="badge-free"><IconStar size={12} /> Artista Fundador n.º {artist.founderNumber}</span>}
        {artist.verifiedAt && <span className="badge-unlocked">✓ Verificado</span>}
        {series.some((s) => s.crownedAt) && <span className="badge-price"><IconCrown size={12} /> Série coroada</span>}
        <span className="badge-muted">{followers} {followers === 1 ? "seguidor" : "seguidores"}</span>
      </div>
      {fUntil && fUntil > new Date() && <p className="mt-1 text-xs text-accent2">Como Artista Fundador ganhas mais em cada episódio até {formatDate(fUntil)}.</p>}

      {best && (
        <section className="card mt-3 space-y-3">
          <p className="text-sm">Série principal: <strong>{best.title}</strong> · nível <strong>{TIER_LABELS[best.tier]}</strong>{best.crownedAt ? " · 👑" : ""}</p>
          {goal && (
            <div>
              <p className="text-xs text-muted">{goal.text}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.round((goal.now / goal.target) * 100))}%` }} /></div>
              <p className="mt-0.5 text-right text-xs text-muted">{goal.now.toLocaleString("pt-AO")} / {goal.target.toLocaleString("pt-AO")} desbloqueios pagos</p>
            </div>
          )}
          {projection > 0 && <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm">Se 500 fãs acabarem a tua série, ganhas <strong className="text-accent">{formatKz(kzToCents(projection))}</strong>.</p>}
          <p className="text-sm text-muted">Os teus {totalUnlocks.toLocaleString("pt-AO")} desbloqueios equivalem aproximadamente a <strong className="text-fg">{(totalUnlocks * cfg.tiktokViewsPerUnlock).toLocaleString("pt-AO")} visualizações</strong> no TikTok.</p>
        </section>
      )}

      {/* Episódios mais rentáveis e público de cada série */}
      <section className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="card">
          <h2 className="font-bold">Episódios que mais renderam</h2>
          {topEps.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Aparecem aqui quando os fãs desbloquearem episódios.</p>
          ) : (
            <ol className="mt-2 space-y-1.5 text-sm">
              {topEps.map((t, i) => (
                <li key={t.episode.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{i + 1}. {t.episode.series.title} — Ep. {t.episode.number}</span>
                  <span className="shrink-0 font-semibold text-ok">{formatKz(t.cents)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-muted">As temporadas desbloqueadas de uma vez contam na série, não num episódio.</p>
        </div>
        <div className="card">
          <h2 className="font-bold">Pessoas a acompanhar</h2>
          {audience.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Quando tiveres séries publicadas, vês aqui quantas pessoas as estão a ver.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {audience.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{a.title}</span>
                  <span className="shrink-0 text-muted"><strong className="text-fg">{a.viewers.toLocaleString("pt-AO")}</strong> a ver · {a.saved.toLocaleString("pt-AO")} na lista</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 10 maiores fãs */}
      <section className="card mt-3">
        <h2 className="flex items-center gap-2 font-bold"><IconTrophy size={18} className="text-accent2" /> Os teus 10 maiores fãs</h2>
        {fans.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Quando os fãs desbloquearem episódios ou te oferecerem presentes, aparecem aqui. Partilha o teu link!</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm">
            {fans.map((f, i) => (
              <li key={f.userId} className="flex justify-between"><span>{i + 1}. {f.displayName}{i === 0 ? " 👑" : ""}</span><span className="text-muted">{f.coins.toLocaleString("pt-AO")} moedas</span></li>
            ))}
          </ol>
        )}
      </section>

      {/* Traz um kamba */}
      <section className="card mt-3">
        <h2 className="font-bold">Traz um kamba 🤝</h2>
        <p className="text-sm text-muted">Convida outro artista. Quando ele fizer a primeira venda, ganhas {formatKz(kzToCents(cfg.artistReferralBonusKz))}.</p>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface2 px-3 py-2">
          <span className="truncate text-sm text-accent2">{inviteLink}</span>
          <CopyButton text={inviteLink} label="Copiar convite" showText />
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Kamba, estou a publicar as minhas séries na app e a ganhar com cada episódio. Regista-te aqui 👉 ${inviteLink}`)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-2 no-underline">Partilhar no WhatsApp</a>
        {invited.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm">
            {invited.map((x) => <li key={x.stageName} className="flex justify-between"><span>{x.stageName}</span><span className={x.referralBonusPaidAt ? "text-ok" : "text-muted"}>{x.referralBonusPaidAt ? "bónus recebido" : "à espera da 1.ª venda"}</span></li>)}
          </ul>
        )}
      </section>

      {/* Definições de avisos */}
      <section className="card mt-3">
        <h2 className="font-bold">Avisos</h2>
        <p className="text-sm text-muted">Recebes sempre: o primeiro fã, o resumo do dia, metas atingidas, bónus e subida de nível.</p>
        <ActionForm action={setNotifyEachUnlockAction} className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <input type="hidden" name="on" value={artist.notifyEachUnlock ? "0" : "1"} />
          <span className="text-sm">Avisar-me a cada desbloqueio: <strong>{artist.notifyEachUnlock ? "ligado" : "desligado"}</strong></span>
          <SubmitButton className="btn-secondary btn-sm">{artist.notifyEachUnlock ? "Desligar" : "Ligar"}</SubmitButton>
        </ActionForm>
      </section>

      {/* Perfil público */}
      <details className="card mt-3">
        <summary className="cursor-pointer font-bold">O teu perfil público (TikTok, Instagram, bio)</summary>
        <ActionForm action={saveArtistLinksAction} className="mt-3 space-y-3">
          <div><label className="label" htmlFor="tiktokUrl">TikTok</label><input className="input" id="tiktokUrl" name="tiktokUrl" type="url" defaultValue={artist.tiktokUrl ?? ""} placeholder="https://www.tiktok.com/@..." /></div>
          <div><label className="label" htmlFor="instagramUrl">Instagram</label><input className="input" id="instagramUrl" name="instagramUrl" type="url" defaultValue={artist.instagramUrl ?? ""} placeholder="https://www.instagram.com/..." /></div>
          <div><label className="label" htmlFor="bio">Sobre ti (curto)</label><textarea className="input" id="bio" name="bio" rows={2} maxLength={300} defaultValue={artist.bio ?? ""} /></div>
          <SubmitButton className="btn-secondary w-full">Guardar perfil</SubmitButton>
        </ActionForm>
      </details>
    </>
  );
}
