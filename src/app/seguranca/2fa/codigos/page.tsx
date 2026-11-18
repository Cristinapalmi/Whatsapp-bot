import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { ClearRecoveryCookie } from "./ClearRecoveryCookie";

export const metadata: Metadata = { title: "Códigos de recuperação" };
export const dynamic = "force-dynamic";

/** Mostra os códigos de recuperação uma única vez, logo depois de ativar os 2 passos. */
export default async function RecoveryCodesPage() {
  const s = await getSession();
  if (!s || s.user.role !== "ADMIN" || !s.mfa) redirect("/entrar");
  const raw = (await cookies()).get("rc")?.value;
  const codes = raw ? raw.split(",") : [];
  return (
    <div className="container-app max-w-md py-6">
      <h1 className="text-2xl font-bold">Autenticação em 2 passos ativada</h1>
      {codes.length > 0 ? (
        <>
          <p className="mt-2 text-sm text-muted">Guarda estes <strong className="text-fg">códigos de recuperação</strong> num sítio seguro (papel ou gestor de palavras-passe). Se perderes o telemóvel, cada código serve para entrar <strong className="text-fg">uma vez</strong>. Não voltam a aparecer.</p>
          <ul className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface p-4 font-mono text-lg">
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <ClearRecoveryCookie />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Os códigos de recuperação já foram mostrados.</p>
      )}
      <Link href="/admin" className="btn-primary mt-6 w-full no-underline">Já guardei — ir para o admin</Link>
    </div>
  );
}
