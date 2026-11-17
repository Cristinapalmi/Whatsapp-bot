export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Endereços reservados que um artista não pode usar como link pessoal. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "artista", "conta", "entrar", "registar", "sair", "serie", "ver",
  "pagar", "legal", "manifest", "sw", "icons", "samples", "covers", "_next", "offline",
  "passe", "ranking", "notificacoes", "denunciar", "sobre", "ajuda",
]);
