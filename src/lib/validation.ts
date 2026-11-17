import { z } from "zod";
import { normalizeAngolanPhone } from "./phone";

export const phoneSchema = z
  .string({ required_error: "Indica o número de telefone." })
  .transform((v, ctx) => {
    const p = normalizeAngolanPhone(v);
    if (!p) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Número de telefone angolano inválido (ex.: 923 456 789)." });
      return z.NEVER;
    }
    return p;
  });

export const passwordSchema = z
  .string()
  .min(6, "A palavra-passe tem de ter pelo menos 6 caracteres.")
  .max(100, "Palavra-passe demasiado longa.");

export const birthDateSchema = z
  .string({ required_error: "Indica a data de nascimento." })
  .refine((v) => !Number.isNaN(Date.parse(v)), "Data de nascimento inválida.")
  .transform((v) => new Date(v));

export const checkbox = (message: string) =>
  z.literal("on", { errorMap: () => ({ message }) });

export const urlSchema = z
  .string()
  .trim()
  .url("Link inválido (começa por https://).")
  .refine((v) => /tiktok\.com|instagram\.com/i.test(v), "Indica um link do TikTok ou do Instagram.");

export const formObject = (fd: FormData) => Object.fromEntries(fd.entries());
