import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatKz, kzToCents } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/dates";
import { episodeStates, hasActivePass } from "@/domain/access";
import { pointsBalance } from "@/domain/points";
import { manualProvider } from "@/domain/payments/providers/manual";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { IconStar } from "@/components/icons";
import { redeemPointsAction, submitPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Pagar" };
export const dynamic = "force-dynamic";

type Search = { episodio?: string; passe?: string; presente?: string; artista?: string };

export default async function PayPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(sp as Record<string, string>).toString();
  const user = await requireUser(`/pagar?${qs}`);

  let title: string;
  let subtitle: string;
  let amount: number;
  let note: string;
  let hidden: Record<string, string>;
  let pointsEpisodeId: string | null = null;
  let alreadyPending = false;

  if (sp.passe) {
    const activePass = await db.weeklyPass.findFirst({ where: { userId: user.id, revokedAt: null, endsAt: { gt: new Date() } }, orderBy: { endsAt: "desc" } });
    title = "Passe semanal";
    subtitle = activePass
      ? `O teu passe atual termina a ${formatDateTime(activePass.endsAt)}. Um novo passe prolonga por mais ${business.weeklyPassDays} dias.`
      : `Vê todos os episódios de todas as séries durante ${business.weeklyPassDays} dias.`;
    amount = kzToCents(business.weeklyPassPriceKz);
    note = "Metade deste valor é dividida pelos artistas que viste esta semana, conforme o tempo que viste cada um.";
    hidden = { kind: "WEEKLY_PASS" };
    alreadyPending = !!(await db.paymentRequest.findFirst({ where: { userId: user.id, kind: "WEEKLY_PASS", status: "PENDING" } }));
  } else if (sp.presente && sp.artista) {
    const gift = business.gifts.find((g) => g.id === sp.presente);
    const artist = await db.artistProfile.findFirst({ where: { slug: sp.artista, status: "APPROVED" } });
    if (!gift || !artist) notFound();
    title = `Oferecer ${gift.label}`;
    subtitle = `Presente para ${artist.stageName}`;
    amount = kzToCents(gift.priceKz);
    note = `Metade deste valor vai diretamente para ${artist.stageName}.`;
    hidden = { kind: "GIFT", artistId: artist.id, giftId: gift.id };
  } else if (sp.episodio) {
    const episode = await db.episode.findFirst({
      where: { id: sp.episodio, published: true, series: { status: "PUBLISHED" } },
      include: { series: { include: { artist: { select: { stageName: true } } } } },
    });
    if (!episode) notFound();
    const state = (await episodeStates(db, user.id, episode.series, [episode]))[episode.id];
    if (state === "free" || state === "unlocked") redirect(`/ver/${episode.id}`);
    alreadyPending = state === "pending";
    title = `Desbloquear episódio ${episode.number}`;
    subtitle = `${episode.series.title} · ${episode.series.artist.stageName}`;
    amount = episode.series.priceCents;
    note = `Metade deste valor vai diretamente para ${episode.series.artist.stageName}.`;
    hidden = { kind: "EPISODE", episodeId: episode.id };
    pointsEpisodeId = episode.id;
  } else {
    notFound();
  }

  const points = pointsEpisodeId ? await pointsBalance(db, user.id) : 0;
  const passActive = sp.episodio ? await hasActivePass(db, user.id) : false;
  const instructions = await manualProvider.initiate({ paymentRequestId: "", amountCents: amount, description: title });

  return (
    <div className="container-app max-w-lg py-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-muted">{subtitle}</p>

      {alreadyPending ? (
        <div className="card mt-6">
          <p className="font-semibold text-warn">Já tens um pedido destes a aguardar confirmação.</p>
          <p className="mt-1 text-sm text-muted">Avisamos-te assim que estiver confirmado.</p>
          <Link href="/conta" className="btn-secondary mt-4">Ver os meus pedidos</Link>
        </div>
      ) : (
        <>
          {pointsEpisodeId && points >= business.points.costPerEpisode && (
            <ActionForm action={redeemPointsAction} className="card mt-6 border border-accent2/40">
              <input type="hidden" name="episodeId" value={pointsEpisodeId} />
              <p className="flex items-center gap-2 font-semibold text-accent2"><IconStar size={18} /> Tens {points} pontos de fã</p>
              <p className="mt-1 text-sm text-muted">Usa {business.points.costPerEpisode} pontos para desbloquear este episódio sem pagar.</p>
              <SubmitButton className="btn-secondary mt-3 w-full">Usar {business.points.costPerEpisode} pontos</SubmitButton>
            </ActionForm>
          )}
          {sp.episodio && !passActive && (
            <Link href="/pagar?passe=1" className="card mt-3 flex items-center justify-between gap-3 no-underline hover:bg-surface2">
              <span><span className="block font-semibold text-fg">Ou ativa o passe semanal</span><span className="text-sm text-muted">Todos os episódios durante {business.weeklyPassDays} dias</span></span>
              <span className="badge-price">{formatKz(kzToCents(business.weeklyPassPriceKz))}</span>
            </Link>
          )}

          <div className="card mt-6">
            <p className="text-sm text-muted">Valor</p>
            <p className="font-display text-4xl font-extrabold text-accent">{formatKz(amount)}</p>
            <p className="mt-2 text-sm text-muted">{note}</p>
          </div>

          <h2 className="mt-6 text-lg font-bold">1. Faz a transferência</h2>
          {instructions.type === "instructions" && (
            <dl className="card mt-2 divide-y divide-white/5">
              {instructions.lines.map((l) => (
                <div key={l.label} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-sm text-muted">{l.label}</dt>
                  <dd className="flex items-center gap-1 text-right font-semibold">
                    {l.value}
                    {(l.label.includes("número") || l.label.includes("IBAN")) && <CopyButton text={l.value.replace(/\s/g, "")} label={`Copiar ${l.label}`} />}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <h2 className="mt-6 text-lg font-bold">2. Envia o comprovativo</h2>
          <ActionForm action={submitPaymentAction} className="mt-2 space-y-4">
            {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <fieldset>
              <legend className="label">Como pagaste?</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="card flex min-h-tap cursor-pointer items-center gap-2 has-[:checked]:ring-2 has-[:checked]:ring-accent">
                  <input type="radio" name="method" value="MULTICAIXA_EXPRESS" defaultChecked className="accent-accent" /> Multicaixa Express
                </label>
                <label className="card flex min-h-tap cursor-pointer items-center gap-2 has-[:checked]:ring-2 has-[:checked]:ring-accent">
                  <input type="radio" name="method" value="BANK_TRANSFER" className="accent-accent" /> Transferência
                </label>
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="payerPhone">Número de onde pagaste</label>
              <input className="input" id="payerPhone" name="payerPhone" type="tel" inputMode="tel" defaultValue={formatPhone(user.phone)} required />
            </div>
            <div>
              <label className="label" htmlFor="transactionRef">N.º da operação</label>
              <input className="input" id="transactionRef" name="transactionRef" placeholder="Aparece no comprovativo" required />
              <p className="hint">Cada comprovativo só pode ser usado uma vez.</p>
            </div>
            <div>
              <label className="label" htmlFor="proof">Fotografia ou captura do comprovativo</label>
              <input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-[#1A0E05]" id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
              <p className="hint">JPG, PNG ou PDF, até 5 MB.</p>
            </div>
            <SubmitButton pendingText="A enviar comprovativo…">Enviar comprovativo</SubmitButton>
            <p className="text-center text-xs text-muted">Depois de enviar, o pedido fica "A aguardar confirmação". Normalmente confirmamos no próprio dia.</p>
          </ActionForm>
        </>
      )}
    </div>
  );
}
