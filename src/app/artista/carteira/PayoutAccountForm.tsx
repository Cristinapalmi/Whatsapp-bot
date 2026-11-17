"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { savePayoutAccountAction } from "./actions";

type Current = { method: "BANK_IBAN" | "MULTICAIXA_EXPRESS"; holderName: string; bankName: string; iban: string; mcxPhone: string } | null;

export function PayoutAccountForm({ fullName, current }: { fullName: string; current: Current }) {
  const [method, setMethod] = useState(current?.method ?? "MULTICAIXA_EXPRESS");
  return (
    <ActionForm action={savePayoutAccountAction} className="card mt-2 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["MULTICAIXA_EXPRESS", "BANK_IBAN"] as const).map((m) => (
          <label key={m} className="flex min-h-tap cursor-pointer items-center gap-2 rounded-xl bg-surface2 px-3 has-[:checked]:ring-2 has-[:checked]:ring-accent">
            <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="accent-accent" />
            {m === "BANK_IBAN" ? "Conta bancária (IBAN)" : "Multicaixa Express"}
          </label>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="holderName">Titular</label>
        <input className="input" id="holderName" name="holderName" defaultValue={current?.holderName ?? fullName} required />
        <p className="hint">Tem de ser igual ao teu nome completo: {fullName}</p>
      </div>
      {method === "BANK_IBAN" ? (
        <>
          <div>
            <label className="label" htmlFor="bankName">Banco</label>
            <input className="input" id="bankName" name="bankName" defaultValue={current?.bankName} placeholder="Ex.: BAI, BFA, BIC, Atlântico, BCI…" required />
          </div>
          <div>
            <label className="label" htmlFor="iban">IBAN</label>
            <input className="input font-mono" id="iban" name="iban" defaultValue={current?.iban} placeholder="AO06 0000 0000 0000 0000 0000 0" required />
          </div>
        </>
      ) : (
        <div>
          <label className="label" htmlFor="mcxPhone">Número Multicaixa Express</label>
          <input className="input" id="mcxPhone" name="mcxPhone" type="tel" inputMode="tel" defaultValue={current?.mcxPhone} placeholder="923 456 789" required />
        </div>
      )}
      <SubmitButton className="btn-secondary w-full">Guardar conta</SubmitButton>
    </ActionForm>
  );
}
