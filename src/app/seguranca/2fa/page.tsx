import { redirect } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { brand } from "@config/brand";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { generateTotpSecret, otpauthUri } from "@/lib/totp";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { enableTotpAction } from "../actions";

export const metadata: Metadata = { title: "Autenticação em 2 passos" };
export const dynamic = "force-dynamic";

/** Configuração obrigatória dos 2 passos para a conta de administração. */
export default async function SetupTotpPage() {
  const s = await getSession();
  if (!s) redirect("/entrar?next=/admin");
  if (s.user.role !== "ADMIN") redirect("/");
  if (s.user.totpEnabled) redirect(s.mfa ? "/admin" : "/entrar/2fa");
  // Novo segredo (ainda não ativo) até a admin confirmar o primeiro código
  let secret = s.user.totpSecret;
  if (!secret) {
    secret = generateTotpSecret();
    await db.user.update({ where: { id: s.user.id }, data: { totpSecret: secret } });
  }
  const uri = otpauthUri(secret, formatPhone(s.user.phone), `${brand.name} Admin`);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });

  return (
    <div className="container-app max-w-md py-6">
      <h1 className="text-2xl font-bold">Ativa a autenticação em 2 passos</h1>
      <p className="mt-2 text-sm text-muted">Para proteger o dinheiro dos artistas e dos fãs, a conta de administração precisa de um código do telemóvel, além da palavra-passe.</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        <li>Instala uma app de autenticação: <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> ou <strong>Authy</strong>.</li>
        <li>Na app, carrega em <strong>+</strong> e lê este código QR:</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Código QR para a app de autenticação" className="mx-auto mt-3 rounded-xl bg-white p-2" width={240} height={240} />
      <p className="mt-2 text-center text-xs text-muted">Não consegues ler? Escreve esta chave na app:</p>
      <p className="mt-1 break-all text-center font-mono text-sm">{secret.replace(/(.{4})/g, "$1 ").trim()}</p>
      <ActionForm action={enableTotpAction} className="mt-5 space-y-3">
        <label className="label" htmlFor="code">3. Escreve o código de 6 dígitos que aparece na app</label>
        <input className="input text-center font-mono text-2xl tracking-widest" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        <SubmitButton>Ativar e continuar</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm"><a href="/admin" className="text-accent2 underline">Já guardei os códigos de recuperação → ir para o admin</a></p>
    </div>
  );
}
