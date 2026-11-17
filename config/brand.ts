/**
 * ============================================================
 *  FICHEIRO DA MARCA — o ÚNICO sítio onde se muda o nome da app
 * ============================================================
 *
 * Para trocar o nome, slogan, cores ou domínio:
 *   1) Muda os valores por defeito aqui em baixo, OU
 *   2) Define as variáveis de ambiente correspondentes (NEXT_PUBLIC_BRAND_...)
 *      no ficheiro .env (no teu computador) ou nas definições da Vercel (online).
 *
 * As variáveis de ambiente têm prioridade sobre os valores por defeito.
 * Nunca escrevas o nome da marca diretamente noutros ficheiros: usa sempre `brand.name`.
 */

const env = (key: string, fallback: string) => {
  const v = process.env[key];
  return v && v.trim().length > 0 ? v.trim() : fallback;
};

export const brand = {
  /** Nome da plataforma (provisório). */
  name: env("NEXT_PUBLIC_BRAND_NAME", "KONTA"),
  /** Slogan curto mostrado na página inicial e no ecrã de instalação. */
  slogan: env("NEXT_PUBLIC_BRAND_SLOGAN", "Minisséries angolanas que te prendem"),
  /** Descrição para o Google e partilhas. */
  description: env(
    "NEXT_PUBLIC_BRAND_DESCRIPTION",
    "Séries curtas feitas por criadores angolanos. Os primeiros episódios são grátis.",
  ),
  /** Domínio público, sem https:// (usado nos links pessoais dos artistas). */
  domain: env("NEXT_PUBLIC_BRAND_DOMAIN", "localhost:3000"),
  /** Cores (tema escuro). */
  colors: {
    accent: env("NEXT_PUBLIC_BRAND_COLOR_ACCENT", "#FF7A2F"), // laranja
    accent2: env("NEXT_PUBLIC_BRAND_COLOR_ACCENT2", "#FFB547"), // amarelo
    background: env("NEXT_PUBLIC_BRAND_COLOR_BG", "#0E0D0C"),
    surface: env("NEXT_PUBLIC_BRAND_COLOR_SURFACE", "#1A1816"),
    surface2: env("NEXT_PUBLIC_BRAND_COLOR_SURFACE2", "#26231F"),
    text: env("NEXT_PUBLIC_BRAND_COLOR_TEXT", "#F6F2EE"),
    muted: env("NEXT_PUBLIC_BRAND_COLOR_MUTED", "#B3AAA1"),
  },
  /** Contacto de apoio mostrado aos utilizadores. */
  supportEmail: env("NEXT_PUBLIC_BRAND_SUPPORT_EMAIL", "apoio@exemplo.ao"),
  supportWhatsapp: env("NEXT_PUBLIC_BRAND_SUPPORT_WHATSAPP", "+244 900 000 000"),
} as const;

/** URL completo do site (para links absolutos). */
export const siteUrl = () =>
  brand.domain.startsWith("localhost") ? `http://${brand.domain}` : `https://${brand.domain}`;

/** Link pessoal de um artista, ex.: konta.ao/tiabela */
export const artistLink = (slug: string) => `${brand.domain}/${slug}`;
