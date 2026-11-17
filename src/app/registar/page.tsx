import Link from "next/link";
import type { Metadata } from "next";
import { business } from "@config/business";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { registerAction } from "./actions";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="container-app max-w-md py-8">
      <h1 className="text-3xl font-bold">Criar conta</h1>
      <p className="mt-1 text-muted">É grátis. Vês os primeiros episódios de cada série sem pagar.</p>
      <ActionForm action={registerAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input className="input" id="name" name="name" autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Telefone</label>
          <input className="input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="923 456 789" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Palavra-passe</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
          <p className="hint">Pelo menos 6 caracteres.</p>
        </div>
        <div>
          <label className="label" htmlFor="birthDate">Data de nascimento</label>
          <input className="input" id="birthDate" name="birthDate" type="date" required />
          <p className="hint">Tens de ter {business.minAgePublic} anos ou mais.</p>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="terms" className="checkbox" required />
          <span>Li e aceito os <Link href="/legal/termos" target="_blank" className="text-accent2 underline">Termos de Utilização</Link>.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="privacy" className="checkbox" required />
          <span>Li e aceito a <Link href="/legal/privacidade" target="_blank" className="text-accent2 underline">Política de Privacidade</Link>.</span>
        </label>
        <SubmitButton pendingText="A criar conta…">Criar conta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        Já tens conta? <Link href="/entrar" className="font-semibold text-accent2 underline">Entrar</Link>
      </p>
    </div>
  );
}
