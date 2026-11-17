import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { getCurrentUser } from "@/lib/auth";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { registerArtistAction } from "./actions";

export const metadata: Metadata = { title: "Registo de artista" };
export const dynamic = "force-dynamic";

export default async function ArtistRegisterPage() {
  const user = await getCurrentUser();
  const pct = business.artistSharePercent;
  return (
    <div className="container-app max-w-xl py-4">
      <h1 className="text-3xl font-bold">Regista-te como artista</h1>
      <p className="mt-1 text-muted">Publica as tuas minisséries e ganha {pct}% de tudo o que o público paga por elas. A tua conta fica ativa depois de aprovada pela nossa equipa.</p>

      <ActionForm action={registerArtistAction} className="mt-6 space-y-4">
        <Field id="stageName" label="Nome artístico" required />
        <Field id="fullName" label="Nome completo (como no BI)" required autoComplete="name" />
        <Field id="biNumber" label="N.º do Bilhete de Identidade" placeholder="001234567LA041" required />
        <Field id="email" label="E-mail" type="email" required autoComplete="email" />
        <Field id="socialUrl" label="Link do teu TikTok ou Instagram" type="url" placeholder="https://www.tiktok.com/@..." required />
        <div>
          <label className="label" htmlFor="category">Categoria principal</label>
          <select id="category" name="category" className="input" required>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="slug">O teu link pessoal</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{brand.domain}/</span>
            <input className="input" id="slug" name="slug" placeholder="o-teu-nome" pattern="[a-z0-9\-]{3,30}" />
          </div>
          <p className="hint">Letras minúsculas, números e hífen. Se deixares vazio, usamos o teu nome artístico.</p>
        </div>
        <div>
          <label className="label" htmlFor="photo">Foto (opcional)</label>
          <input className="input" id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>

        {!user && (
          <fieldset className="card space-y-4">
            <legend className="px-1 text-sm font-semibold">Dados de acesso</legend>
            <Field id="phone" label="Telefone" type="tel" placeholder="923 456 789" required autoComplete="tel" />
            <Field id="password" label="Palavra-passe (mín. 6 caracteres)" type="password" required autoComplete="new-password" />
            <Field id="birthDate" label="Data de nascimento (18+)" type="date" required />
          </fieldset>
        )}
        {user && <p className="text-sm text-muted">Vais usar a conta com que entraste ({user.name}).</p>}

        <fieldset className="card space-y-4">
          <legend className="px-1 text-sm font-semibold">Política do Artista — todas as caixas são obrigatórias</legend>
          <Check name="c1">1. Autorizo a plataforma {brand.name} a mostrar as minhas séries.</Check>
          <Check name="c2">2. Aceito que os primeiros episódios de cada série sejam grátis (número acordado comigo).</Check>
          <Check name="c3">3. Aceito {pct}% para mim e {100 - pct}% para a plataforma sobre o que o público paga (calculado depois de eventuais comissões de pagamento), e as regras do passe semanal e dos presentes.</Check>
          <Check name="c4">4. O conteúdo é meu e não tem conteúdo sexual, ataques ou acusações a pessoas reais, ódio, nem conteúdo roubado.</Check>
          <Check name="c5">5. Aceito as regras de levantamento (saldo pendente/disponível, mínimo de {business.minWithdrawalKz.toLocaleString("pt-AO")} Kz, prazos).</Check>
          <p className="text-xs text-muted">Lê a <Link href="/legal/politica-artista" target="_blank" className="text-accent2 underline">Política do Artista</Link> completa e o <Link href="/legal/acordo-artista" target="_blank" className="text-accent2 underline">Acordo do Artista</Link>.</p>
        </fieldset>
        <Check name="terms">Li e aceito os <Link href="/legal/termos" target="_blank" className="text-accent2 underline">Termos</Link> e a <Link href="/legal/privacidade" target="_blank" className="text-accent2 underline">Política de Privacidade</Link>.</Check>

        <SubmitButton pendingText="A enviar registo…">Enviar registo</SubmitButton>
      </ActionForm>
    </div>
  );
}

function Field({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input className="input" id={id} name={id} {...rest} />
    </div>
  );
}

function Check({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-sm leading-relaxed">
      <input type="checkbox" name={name} className="checkbox" required />
      <span>{children}</span>
    </label>
  );
}
