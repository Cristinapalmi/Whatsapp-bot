"use client";
import { useRef } from "react";
import { ActionForm } from "@/components/ActionForm";
import { rejectPaymentAction } from "../actions";

/** Rejeitar (com motivo) ou Rejeitar e bloquear (lista negra: a pessoa deixa de poder enviar comprovativos). */
export function RejectForm({ id }: { id: string }) {
  const block = useRef<HTMLInputElement>(null);
  return (
    <ActionForm action={rejectPaymentAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="block" defaultValue="0" ref={block} />
      <input name="reason" className="input" placeholder="Motivo da rejeição" required minLength={3} />
      <div className="flex gap-2">
        <button type="submit" onClick={() => { if (block.current) block.current.value = "0"; }} className="btn-danger btn-sm flex-1">Rejeitar</button>
        <button type="submit" onClick={() => { if (block.current) block.current.value = "1"; }} className="btn-danger btn-sm flex-1">Rejeitar e bloquear</button>
      </div>
    </ActionForm>
  );
}
