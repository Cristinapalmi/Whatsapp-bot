import Link from "next/link";
import type { Metadata } from "next";
import { brand, siteUrl } from "@config/brand";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureInviteCode, inviteSummary } from "@/domain/fans/invites";
import { pointsBalance } from "@/domain/points";
import { CopyButton } from "@/components/CopyButton";
import { IconStar } from "@/components/icons";

export const metadata: Metadata = { title: "Convidar amigos" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  PENDING: "à espera", VALID: "válido ✓", SUSPICIOUS: "em análise", VOID: "anulado", EXPIRED: "não voltou", LIMIT: "limite do mês",
};

export default async function InvitePage() {
  const user = await requireUser("/convidar");
  const code = await ensureInviteCode(db, user.id);
  const [sum, points, invites] = await Promise.all([
    inviteSummary(db, user.id),
    pointsBalance(db, user.id),
    db.fanInvite.findMany({ where: { inviterId: user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { invitee: { select: { name: true } } } }),
  ]);
  const link = `${siteUrl()}/?amigo=${code}`;
  const msg = `Mano, vê esta série, está a bater! 🔥 Os 3 primeiros episódios são grátis 👉 ${link}`;
  const progress = Math.min(100, Math.round((sum.valid / sum.ambassadorTarget) * 100));

  return (
    <div className="container-app max-w-xl">
      <h1 className="text-2xl font-bold">Convidar amigos</h1>
      <p className="mt-1 text-sm text-muted">Convida os teus amigos para a {brand.name} e ganhem pontos os dois. Tens <strong className="text-fg">{points} pontos</strong>.</p>

      <section className="mt-4 rounded-3xl bg-gradient-to-br from-accent/25 to-surface p-5">
        <p className="text-sm text-muted">O teu link</p>
        <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-surface2 px-3 py-2">
          <span className="truncate text-sm text-accent2">{link}</span>
          <CopyButton text={link} label="Copiar link" showText />
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="btn-primary mt-3 w-full no-underline">Partilhar no WhatsApp</a>
      </section>

      <section className="card mt-4">
        <h2 className="flex items-center gap-2 font-bold"><IconStar size={18} className="text-accent2" /> Embaixador {brand.name}</h2>
        {sum.ambassador ? (
          <p className="mt-1 text-sm text-ok">És Embaixador {brand.name} 🏅 — obrigado por trazeres a malta!</p>
        ) : (
          <p className="mt-1 text-sm text-muted">Com {sum.ambassadorTarget} convites válidos ganhas o selo de Embaixador.</p>
        )}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full bg-accent" style={{ width: `${progress}%` }} /></div>
        <p className="mt-1 text-right text-xs text-muted">{sum.valid} / {sum.ambassadorTarget} convites válidos{sum.pending ? ` · ${sum.pending} à espera` : ""}</p>
      </section>

      <section className="card mt-4 text-sm">
        <h2 className="font-bold">Como funciona</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-fg/90">
          <li>O teu amigo cria conta pelo teu link e vê um episódio até ao fim.</li>
          <li>Se ele voltar <strong>outro dia</strong> e vir outro episódio, ganham os dois <strong>{sum.cfg.inviteWatchPoints} pontos</strong> (ficam em espera {sum.cfg.invitePendingHours} h).</li>
          <li>Quando ele fizer a primeira compra de moedas, ganhas mais <strong>{sum.cfg.invitePurchasePoints} pontos</strong>.</li>
        </ol>
        <p className="mt-2 text-xs text-muted">Até {sum.cfg.inviteMonthlyLimit} convites com prémio por mês. Uma conta por telefone; contas repetidas no mesmo aparelho não contam. Os pontos não são dinheiro: 100 pontos = 1 episódio. <Link href="/legal/termos" className="underline">Termos</Link></p>
      </section>

      {invites.length > 0 && (
        <section className="mt-4">
          <h2 className="font-bold">Os teus convites</h2>
          <ul className="mt-2 divide-y divide-white/5 rounded-2xl bg-surface px-4 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex justify-between py-2"><span>{i.invitee.name.split(" ")[0]}</span><span className={i.status === "VALID" ? "text-ok" : "text-muted"}>{STATUS[i.status] ?? i.status}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
