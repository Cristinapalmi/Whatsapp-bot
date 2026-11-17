import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="container-app max-w-md py-8">
      <h1 className="text-3xl font-bold">Entrar</h1>
      <p className="mt-1 text-muted">Usa o teu número de telefone e a palavra-passe.</p>
      <ActionForm action={loginAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="phone">Telefone</label>
          <input className="input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="923 456 789" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Palavra-passe</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <SubmitButton pendingText="A entrar…">Entrar</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tens conta? <Link href={`/registar${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-accent2 underline">Criar conta grátis</Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        És criador de conteúdo? <Link href="/artista/registar" className="font-semibold text-accent2 underline">Regista-te como artista</Link>
      </p>
      <p className="mt-6 text-center text-xs text-muted">Esqueceste a palavra-passe? Fala connosco pelo apoio para a recuperar.</p>
    </div>
  );
}
