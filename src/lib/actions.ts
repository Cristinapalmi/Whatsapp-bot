import { UserFacingError } from "@/domain/errors";
import { MoneyError } from "@/domain/money/split";
import type { ActionResult } from "@/components/ActionForm";
import { ZodError } from "zod";

/** Converte erros em mensagens simples para o utilizador. */
export function toActionError(e: unknown): ActionResult {
  if (e instanceof UserFacingError || e instanceof MoneyError) return { error: e.message };
  if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Dados inválidos." };
  // Os redirecionamentos do Next.js são "erros" especiais: deixar passar.
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  console.error(e);
  return { error: "Ocorreu um erro. Tenta outra vez dentro de momentos." };
}
