import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { coinsLabel, formatKz } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { coinBalance, defaultEpisodePriceCoins, packBonusPercent } from "@/domain/coins/service";
import { IconChevronLeft, IconCoin, IconSparkle } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Loja de moedas" };
export const dynamic = "force-dynamic";

export default async function StorePage({ searchParams }: { searchParams: Promise<{ pedido?: string; voltar?: string }> }) {
  const { pedido, voltar } = await searchParams;
  const user = await getCurrentUser();
  const [packs, price, balance, pending, lots, spends] = await Promise.all([
    db.coinPack.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceKz: "asc" }] }),
    defaultEpisodePriceCoins(db),
    user ? coinBalance(db, user.id) : 0,
    user ? db.paymentRequest.findMany({ where: { userId: user.id, kind: "COINS", status: "PENDING" }, orderBy: { createdAt: "desc" } }) : [],
    user ? db.coinLot.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }) : [],
    user
      ? db.coinSpend.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { episode: { select: { number: true, series: { select: { title: true } } } }, series: { select: { title: true } }, artist: { select: { stageName: true } } },
        })
      : [],
  ]);
  const base = packs.reduce((a, p) => (p.priceKz < a.priceKz ? p : a), packs[0] ?? { priceKz: 1, coins: 1 });
  const back = voltar?.startsWith("/") && !voltar.startsWith("//") ? voltar : null;
  const history = [
    ...lots.map((l) => ({ date: l.createdAt, text: l.revokedAt ? "Compra anulada" : "Compra de moedas", coins: l.revokedAt ? 0 : l.coinsTotal, revoked: !!l.revokedAt })),
    ...spends.map((s) => ({
      date: s.createdAt,
      text: s.kind === "EPISODE" && s.episode ? `${s.episode.series.title} — Ep. ${s.episode.number}` : s.kind === "SEASON" && s.series ? `${s.series.title} — temporada completa` : `Presente para ${s.artist.stageName}`,
      coins: s.reversedAt ? 0 : -s.coins,
      revoked: !!s.reversedAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 25);

  return (
    <div className="container-app max-w-2xl">
      {back && <Link href={back} className="btn-ghost btn-sm -ml-3 text-muted"><IconChevronLeft size={18} /> Voltar ao episódio</Link>}
      <h1 className="text-3xl font-bold">Loja</h1>

      {pedido === "enviado" && (
        <p role="status" className="mt-3 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">
          Comprovativo enviado! As moedas entram na tua carteira assim que confirmarmos o pagamento. Avisamos-te nas notificações.
        </p>
      )}

      <section className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-accent/30 via-surface to-surface p-5">
        <p className="text-sm text-muted">{user ? "O teu saldo" : "Moedas"}</p>
        <p className="flex items-center gap-2 font-display text-4xl font-extrabold text-accent2"><IconCoin size={32} /> {user ? coinsLabel(balance) : "Desbloqueia episódios"}</p>
        <p className="mt-1 text-sm text-fg/80">Cada episódio custa normalmente {coinsLabel(price)}. Os primeiros episódios de cada série são grátis.</p>
        {pending.length > 0 && <p className="mt-2 text-sm text-warn">{pending.length} compra(s) a aguardar confirmação: +{coinsLabel(pending.reduce((a, p) => a + (p.coins ?? 0), 0))}</p>}
      </section>

      <h2 className="mt-6 text-lg font-bold">Escolhe um pacote</h2>
      {packs.length === 0 ? (
        <EmptyState title="Pacotes a caminho" text="A loja está a ser preparada. Volta daqui a pouco." />
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {packs.map((p) => {
            const bonus = packBonusPercent(p, base);
            const href = user ? `/pagar?pacote=${p.id}${back ? `&voltar=${encodeURIComponent(back)}` : ""}` : `/entrar?next=${encodeURIComponent("/loja")}`;
            return (
              <li key={p.id}>
                <Link href={href} className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-surface p-4 no-underline transition hover:border-accent">
                  {bonus > 0 && <span className="absolute -top-2 right-3 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-[#1A0E05]">+{bonus}%</span>}
                  <span className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-fg"><IconCoin size={22} className="text-accent2" /> {p.coins.toLocaleString("pt-AO")}</span>
                  <span className="text-xs text-muted">moedas · ≈ {Math.floor(p.coins / price)} episódios</span>
                  <span className="mt-3 text-lg font-semibold text-accent">{formatKz(p.priceKz * 100)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="card mt-4 flex gap-3 text-sm text-muted">
        <IconSparkle size={20} className="shrink-0 text-accent2" />
        <p>Pagas por Multicaixa Express ou transferência e envias o comprovativo. As moedas <strong className="text-fg">não têm prazo</strong>, mas <strong className="text-fg">não são reembolsáveis, não se transferem e não se trocam por dinheiro</strong>. Metade do valor que gastas numa série vai para o artista. <Link href="/legal/termos" className="text-accent2 underline">Termos</Link></p>
      </div>

      {user && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Histórico de moedas</h2>
          {history.length === 0 ? (
            <EmptyState title="Ainda sem movimentos" text="Quando comprares ou usares moedas, aparecem aqui." action={{ href: "/", label: "Descobrir séries em alta" }} />
          ) : (
            <ul className="mt-2 divide-y divide-white/5 rounded-2xl bg-surface px-4">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className={h.revoked ? "text-muted line-through" : ""}>{h.text}</p>
                    <p className="text-xs text-muted">{formatDateTime(h.date)}{h.revoked ? " · anulado" : ""}</p>
                  </div>
                  <span className={`font-semibold ${h.coins > 0 ? "text-ok" : "text-fg"}`}>{h.coins > 0 ? "+" : ""}{h.coins === 0 ? "—" : h.coins}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
