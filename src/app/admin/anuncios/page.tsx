import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { mediaUrl } from "@/lib/media";
import { adOfferLimit, monthKeyLuanda } from "@/domain/ads/service";
import { balance } from "@/domain/money/ledger";
import { adPool } from "@/domain/money/accounts";
import { monthRange } from "@/domain/ranking";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { VideoUploader } from "../series/[id]/VideoUploader";
import { distributeAdPoolAction, registerAdRevenueAction, saveAdAction, saveAdOfferLimitAction } from "../actions";

export const metadata: Metadata = { title: "Anúncios" };

const isoDay = (d: Date | null) => (d ? new Date(d.getTime() + 3600_000).toISOString().slice(0, 10) : "");

export default async function AdminAds() {
  const now = new Date();
  const thisMonth = monthKeyLuanda(now);
  const [limit, ads, unlocksTotal, unlocksMonth, revenues, unlockGroups, poolAccounts, distEntries] = await Promise.all([
    adOfferLimit(db),
    db.ad.findMany({ orderBy: { createdAt: "desc" } }),
    db.adUnlock.count(),
    db.adUnlock.count({ where: { month: thisMonth } }),
    db.adRevenue.findMany({ orderBy: { createdAt: "desc" } }),
    db.adUnlock.groupBy({ by: ["month"], _count: { _all: true } }),
    db.ledgerAccount.findMany({ where: { code: { startsWith: "ad-pool:" } }, select: { code: true } }),
    db.journalEntry.findMany({ where: { kind: { in: ["AD_DISTRIBUTION", "AD_ROLLOVER"] } }, include: { lines: { include: { account: true } } } }),
  ]);
  const videos = await Promise.all(ads.map((a) => (a.videoKey ? mediaUrl(a.videoKey) : null)));
  const impressions = ads.reduce((s, a) => s + a.impressions, 0);
  const completions = ads.reduce((s, a) => s + a.completions, 0);

  // Resumo por mês: desbloqueios, receita registada, fundo por dividir, já distribuído aos artistas
  const months = new Set<string>([thisMonth, ...unlockGroups.map((u) => u.month), ...revenues.map((r) => r.month), ...poolAccounts.map((p) => p.code.slice(8))]);
  const rows = await Promise.all(
    [...months].sort().reverse().map(async (m) => ({
      month: m,
      unlocks: unlockGroups.find((u) => u.month === m)?._count._all ?? 0,
      revenue: revenues.filter((r) => r.month === m).reduce((s, r) => s + r.amountCents, 0),
      pool: await balance(db, adPool(m)),
      distributed: distEntries
        .filter((e) => e.idempotencyKey.startsWith(`ad-dist:${m}:`))
        .reduce((s, e) => s - e.lines.filter((l) => l.account.code.startsWith("artist:")).reduce((a, l) => a + l.amountCents, 0), 0),
      ended: now >= monthRange(m).to,
    })),
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Anúncios</h1>
      <p className="mt-1 text-sm text-muted">Cada conta pode desbloquear episódios vendo um anúncio até ao fim, um número limitado de vezes no total (oferta única). Estes episódios contam para o fundo mensal de anúncios dos artistas.</p>

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Anúncios começados" value={impressions} />
        <Kpi label="Vistos até ao fim" value={completions} />
        <Kpi label="Ofertas usadas (total)" value={unlocksTotal} />
        <Kpi label={`Ofertas usadas (${thisMonth})`} value={unlocksMonth} />
      </section>

      <section className="card mt-4">
        <h2 className="font-bold">Limite da oferta</h2>
        <ActionForm action={saveAdOfferLimitAction} className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="adOfferLimit">Vezes por conta (para sempre)</label>
            <input className="input w-32" id="adOfferLimit" name="adOfferLimit" type="number" min={0} max={50} defaultValue={limit} required />
          </div>
          <SubmitButton className="btn-primary">Guardar</SubmitButton>
          <p className="hint w-full">0 = oferta desligada. Por defeito: 1. O limite também vale por número de telefone.</p>
        </ActionForm>
      </section>

      <h2 className="mt-8 text-lg font-bold">Anúncios da casa</h2>
      <p className="text-sm text-muted">Vídeos curtos (15–30 s, MP4) de patrocinadores. Só aparecem os ativos, com vídeo, dentro das datas.</p>
      <ul className="mt-3 space-y-3">
        {ads.map((a, i) => (
          <li key={a.id} className="card grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <div className="aspect-video overflow-hidden rounded-xl bg-surface2">
                {videos[i] ? <video src={videos[i]!} controls preload="none" className="h-full w-full object-contain" /> : <p className="p-3 text-xs text-muted">Sem vídeo</p>}
              </div>
              <VideoUploader episodeId={a.id} quality="ad" hasVideo={!!a.videoKey} label={a.videoKey ? `Vídeo (${a.durationSec} s)` : "Carregar vídeo"} />
              <p className="text-xs text-muted">{a.impressions} começados · {a.completions} vistos até ao fim</p>
            </div>
            <ActionForm action={saveAdAction} className="grid grid-cols-2 gap-3">
              <input type="hidden" name="id" value={a.id} />
              <div><label className="label" htmlFor={`as-${a.id}`}>Patrocinador</label><input className="input" id={`as-${a.id}`} name="sponsor" defaultValue={a.sponsor} required /></div>
              <div><label className="label" htmlFor={`at-${a.id}`}>Título (opcional)</label><input className="input" id={`at-${a.id}`} name="title" defaultValue={a.title ?? ""} /></div>
              <div className="col-span-2"><label className="label" htmlFor={`al-${a.id}`}>Link (opcional)</label><input className="input" id={`al-${a.id}`} name="linkUrl" type="url" placeholder="https://" defaultValue={a.linkUrl ?? ""} /></div>
              <div><label className="label" htmlFor={`ai-${a.id}`}>Começa em</label><input className="input" id={`ai-${a.id}`} name="startsAt" type="date" defaultValue={isoDay(a.startsAt)} /></div>
              <div><label className="label" htmlFor={`af-${a.id}`}>Acaba em</label><input className="input" id={`af-${a.id}`} name="endsAt" type="date" defaultValue={isoDay(a.endsAt)} /></div>
              <label className="flex min-h-tap items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={a.active} className="checkbox mt-0" /> Ativo</label>
              <SubmitButton className="btn-secondary">Guardar</SubmitButton>
              <p className="col-span-2 text-xs text-muted">
                {!a.videoKey ? "Falta o vídeo." : !a.active ? "Inativo." : a.endsAt && a.endsAt < now ? `Terminou a ${formatDate(a.endsAt)}.` : a.startsAt && a.startsAt > now ? `Começa a ${formatDate(a.startsAt)}.` : "A aparecer aos fãs."}
              </p>
            </ActionForm>
          </li>
        ))}
      </ul>
      <ActionForm action={saveAdAction} className="card mt-3 grid grid-cols-2 items-end gap-3 md:grid-cols-[1fr_1fr_auto]" resetOnSuccess>
        <div><label className="label" htmlFor="na-s">Novo anúncio: patrocinador</label><input className="input" id="na-s" name="sponsor" required /></div>
        <div><label className="label" htmlFor="na-l">Link (opcional)</label><input className="input" id="na-l" name="linkUrl" type="url" placeholder="https://" /></div>
        <SubmitButton className="btn-primary">Criar</SubmitButton>
      </ActionForm>

      <h2 className="mt-8 text-lg font-bold">Receita de anúncios e fundo dos artistas</h2>
      <p className="text-sm text-muted">Regista o que os patrocinadores pagaram em cada mês. Metade vai para o fundo do mês e, depois de o mês terminar, é dividida pelos artistas conforme os episódios deles desbloqueados com anúncio nesse mês.</p>
      <ActionForm action={registerAdRevenueAction} className="card mt-3 grid grid-cols-2 items-end gap-3 md:grid-cols-[130px_150px_1fr_1fr_auto]" resetOnSuccess>
        <div><label className="label" htmlFor="rv-m">Mês</label><input className="input" id="rv-m" name="month" type="month" defaultValue={thisMonth} required /></div>
        <div><label className="label" htmlFor="rv-a">Valor (Kz)</label><input className="input" id="rv-a" name="amountKz" type="number" min={1} step="0.01" required /></div>
        <div><label className="label" htmlFor="rv-s">Patrocinador</label><input className="input" id="rv-s" name="sponsor" /></div>
        <div><label className="label" htmlFor="rv-d">Nota</label><input className="input" id="rv-d" name="description" /></div>
        <SubmitButton className="btn-primary">Registar</SubmitButton>
      </ActionForm>

      <div className="mt-4 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Mês</th><th>Episódios com anúncio</th><th>Receita registada</th><th>Fundo por dividir</th><th>Já distribuído aos artistas</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="font-mono">{r.month}</td>
                <td>{r.unlocks}</td>
                <td>{formatKz(r.revenue)}</td>
                <td>{formatKz(r.pool)}</td>
                <td>{formatKz(r.distributed)}</td>
                <td>
                  {r.pool > 0 && r.ended ? (
                    <ActionForm action={distributeAdPoolAction}>
                      <input type="hidden" name="month" value={r.month} />
                      <SubmitButton className="btn-secondary btn-sm">Dividir pelos artistas</SubmitButton>
                    </ActionForm>
                  ) : r.pool > 0 ? (
                    <span className="text-xs text-muted">Divide-se quando o mês terminar</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-muted">Rede de anúncios externa (ex.: Google Ad Manager): preparada mas desligada. Ver docs/ANUNCIOS.md.</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl font-bold">{value.toLocaleString("pt-AO")}</p>
    </div>
  );
}
