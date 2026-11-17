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
