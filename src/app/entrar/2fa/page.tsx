import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { verifyTotpAction } from "@/app/seguranca/actions";

export const metadata: Metadata = { title: "Código de segurança" };
export const dynamic = "force-dynamic";

export default async function VerifyTotpPage() {
  const s = await getSession();
  if (!s) redirect("/entrar?next=/admin");
  if (s.user.role !== "ADMIN") redirect("/");
  if (!s.user.totpEnabled) redirect("/seguranca/2fa");
  if (s.mfa) redirect("/admin");
  return (
    <div className="container-app max-w-sm py-8">
      <h1 className="text-2xl font-bold">Código de segurança</h1>
      <p className="mt-2 text-sm text-muted">Abre a app de autenticação no telemóvel e escreve o código de 6 dígitos.</p>
      <ActionForm action={verifyTotpAction} className="mt-5 space-y-3">
        <input className="input text-center font-mono text-2xl tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={11} aria-label="Código" required autoFocus />
        <SubmitButton>Entrar no admin</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-xs text-muted">Perdeste o telemóvel? Escreve um dos códigos de recuperação (ex.: ABCDE-FGHIJ). Sem eles: na Vercel define ADMIN_RESET_2FA=true e faz Redeploy; depois apaga a variável.</p>
    </div>
  );
}
