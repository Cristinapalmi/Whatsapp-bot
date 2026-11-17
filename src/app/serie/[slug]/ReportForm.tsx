"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { IconFlag } from "@/components/icons";
import { reportAction } from "./actions";

export function ReportForm({ seriesId, loggedIn }: { seriesId: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm text-muted">
        <IconFlag size={18} /> Denunciar esta série
      </button>
    );
  if (!loggedIn) return <p className="text-sm text-muted">Entra na tua conta para denunciar.</p>;
  return (
    <ActionForm action={reportAction} className="card max-w-lg space-y-3" resetOnSuccess>
      <input type="hidden" name="seriesId" value={seriesId} />
      <label className="label" htmlFor="reason">Motivo</label>
      <select id="reason" name="reason" className="input" required>
        <option value="Conteúdo sexual">Conteúdo sexual</option>
        <option value="Ataque ou acusação a pessoa real">Ataque ou acusação a pessoa real</option>
        <option value="Ódio ou violência">Ódio ou violência</option>
        <option value="Conteúdo roubado">Conteúdo roubado (não é do artista)</option>
        <option value="Outro">Outro</option>
      </select>
      <textarea name="details" className="input" rows={3} placeholder="Detalhes (opcional)" maxLength={1000} />
      <SubmitButton className="btn-secondary">Enviar denúncia</SubmitButton>
    </ActionForm>
  );
}
