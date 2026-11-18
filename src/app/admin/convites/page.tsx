import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { EmptyState } from "@/components/EmptyState";
import { SettingsGroupForm } from "@/components/SettingsGroupForm";
import { blockFromPointsAction, voidInviteAction } from "../actions";

export const metadata: Metadata = { title: "Convites suspeitos" };

export default async function AdminInvites() {
  const [suspicious, recent] = await Promise.all([
    db.fanInvite.findMany({ where: { status: "SUSPICIOUS" }, orderBy: { createdAt: "desc" }, take: 50, include: { inviter: true, invitee: true } }),
    db.fanInvite.findMany({ where: { status: { in: ["VALID", "PENDING"] } }, orderBy: { createdAt: "desc" }, take: 30, include: { inviter: true, invitee: true } }),
  ]);
  const row = (i: (typeof suspicious)[number]) => (
    <li key={i.id} className="card space-y-2 text-sm">
      <p><strong>{i.inviter.name}</strong> ({formatPhone(i.inviter.phone)}) convidou <strong>{i.invitee.name}</strong> ({formatPhone(i.invitee.phone)})</p>
      <p className="text-xs text-muted">{formatDateTime(i.createdAt)} · estado: {i.status}{i.reason ? ` · 🚩 ${i.reason}` : ""}{i.inviter.pointsBlocked ? " · quem convidou está bloqueado" : ""}</p>
      <div className="flex flex-wrap gap-2">
        <ActionForm action={voidInviteAction}><input type="hidden" name="id" value={i.id} /><SubmitButton className="btn-secondary btn-sm">Anular pontos</SubmitButton></ActionForm>
        {!i.inviter.pointsBlocked && <ActionForm action={blockFromPointsAction}><input type="hidden" name="userId" value={i.inviterId} /><SubmitButton className="btn-danger btn-sm">Bloquear</SubmitButton></ActionForm>}
      </div>
    </li>
  );
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Convites suspeitos</h1>
      <p className="mt-1 text-sm text-muted">Convites de fãs com sinais de batota (mesmo aparelho, muitas contas da mesma ligação…). Não dão pontos até decidires. “Bloquear” impede essa pessoa de ganhar pontos de convites e de presença.</p>
      {suspicious.length === 0 ? <EmptyState title="Nada suspeito" text="Quando houver convites com sinais de batota, aparecem aqui." /> : <ul className="mt-3 space-y-2">{suspicious.map(row)}</ul>}
      <h2 className="mt-8 text-lg font-bold">Convites recentes</h2>
      <ul className="mt-2 space-y-2">{recent.map(row)}</ul>
      <details className="card mt-8">
        <summary className="cursor-pointer font-bold">Regras dos fãs (convites, presença, Embaixador)</summary>
        <SettingsGroupForm group="fas" />
      </details>
    </div>
  );
}
