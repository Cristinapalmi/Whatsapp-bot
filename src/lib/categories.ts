import type { Category } from "@prisma/client";

export const CATEGORY_LABELS: Record<Category, string> = {
  TERROR: "Terror",
  COMEDIA: "Comédia",
  DRAMA: "Drama",
  MAKAS_FAMILIA: "Makas de família",
  ROMANCE: "Romance",
  ACAO: "Ação",
  OUTRO: "Outro",
};

export const HOME_ROWS: Category[] = ["TERROR", "COMEDIA", "DRAMA", "MAKAS_FAMILIA"];
export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

/** Etiquetas que o artista pode escolher (até 6). */
export const SERIES_TAGS = ["romance", "vingança", "comédia", "terror", "família", "kuduro", "musseque", "drama", "mistério", "traição", "amizade", "escola", "igreja", "bairro", "dinheiro", "feitiço"] as const;
export const AGE_LABELS: Record<string, string> = { ALL: "Todos", AGE13: "+13", AGE16: "+16", AGE18: "+18" };
export const LANGUAGE_LABELS: Record<string, string> = { PT: "Português", PT_NATIONAL: "Português + línguas nacionais" };
