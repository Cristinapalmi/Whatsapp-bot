import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { getCurrentUser } from "@/lib/auth";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { formatKz, kzLabel } from "@/lib/money";
import { db } from "@/lib/db";
import { foundersLeft, totalPaidToArtists } from "@/domain/artists/growth";
import { getInts } from "@/domain/settings";
import { registerArtistAction } from "./actions";

export const metadata: Metadata = { title: "Registo de artista" };
export const dynamic = "force-dynamic";

export default async function ArtistRegisterPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const { convite } = await searchParams;
  const user = await getCurrentUser();
  const pct = business.artistSharePercent;
  const [founders, paidCents, inviter, fcfg] = await Promise.all([
    foundersLeft(db),
    totalPaidToArtists(db),
    convite ? db.artistProfile.findUnique({ where: { slug: convite.toLowerCase() }, select: { stageName: true, slug: true } }) : null,
    getInts(db, ["founderMonths", "founderSharePercent"]),
  ]);
  const firstMin = (await getInts(db, ["payoutFirstMinKz"])).payoutFirstMinKz;
  return (
    <div className="container-app max-w-xl py-4">
      <h1 className="text-3xl font-bold">Regista-te como artista</h1>
      <p className="mt-1 text-muted">Publica as tuas minisséries e ganha dinheiro com cada episódio desbloqueado pelos teus fãs. Quanto mais assistirem, mais ganhas. A tua conta fica ativa logo: podes criar a tua primeira série hoje.</p>

      {inviter && <p className="mt-3 rounded-xl bg-accent2/15 px-4 py-3 text-sm text-accent2">Foste convidado por <strong>{inviter.stageName}</strong>. Bem-vindo, kamba!</p>}
      {founders.left > 0 && (
        <div className="mt-4 rounded-2xl border border-accent/50 bg-accent/10 p-4">
          <p className="font-display text-lg font-extrabold text-accent">Restam {founders.left} de {founders.limit} vagas de Artista Fundador</p>
          <p className="mt-1 text-sm text-fg/90">Os Artistas Fundadores ganham mais nos primeiros {fcfg.founderMonths} meses, ficam com o selo “Artista Fundador” para sempre e as séries começam logo no nível Normal.</p>
        </div>
      )}
      {paidCents > 0 && <p className="mt-3 text-sm text-ok">A {brand.name} já pagou {formatKz(paidCents)} aos artistas.</p>}

      <ActionForm action={registerArtistAction} className="mt-6 space-y-4">
        {inviter && <input type="hidden" name="convite" value={inviter.slug} />}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Não preencher<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
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
            <Field id="password" label="Palavra-passe (mín. 8 caracteres)" type="password" required minLength={8} autoComplete="new-password" />
            <Field id="birthDate" label="Data de nascimento (18+)" type="date" required />
          </fieldset>
        )}
        {user && <p className="text-sm text-muted">Vais usar a conta com que entraste ({user.name}).</p>}

        <fieldset className="card space-y-4">
          <legend className="px-1 text-sm font-semibold">Para começar, confirma (obrigatório)</legend>
          <Check name="c1">1. Autorizo a {brand.name} a mostrar as minhas séries.</Check>
          <Check name="c2">2. Aceito que os primeiros episódios sejam grátis, para atrair público.</Check>
          <Check name="c3">3. Ganho {pct}% de cada episódio desbloqueado pelos meus fãs ({fcfg.founderSharePercent}% nos primeiros {fcfg.founderMonths} meses, se for Artista Fundador).</Check>
          <Check name="c4">4. O conteúdo é meu e respeita as regras da comunidade.</Check>
          <Check name="c5">5. Aceito as regras de levantamento (a partir de {kzLabel(firstMin)}).</Check>
          <p className="text-xs text-muted">Todos os detalhes estão na <Link href="/legal/politica-artista" target="_blank" className="text-accent2 underline">Política do Artista</Link> e no <Link href="/legal/acordo-artista" target="_blank" className="text-accent2 underline">Acordo do Artista</Link> completos.</p>
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
