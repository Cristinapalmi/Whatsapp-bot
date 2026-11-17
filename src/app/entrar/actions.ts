"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, tooManyLoginAttempts, verifyPassword } from "@/lib/auth";
import { formObject, phoneSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import type { ActionResult } from "@/components/ActionForm";

const schema = z.object({ phone: phoneSchema, password: z.string().min(1, "Indica a palavra-passe."), next: z.string().optional() });

export async function loginAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let next = "/";
  try {
    const data = schema.parse(formObject(fd));
    if (await tooManyLoginAttempts(data.phone))
      return { error: "Demasiadas tentativas. Espera 15 minutos e tenta outra vez." };
    const user = await db.user.findUnique({ where: { phone: data.phone } });
    const ok = !!user && !user.disabled && (await verifyPassword(data.password, user.passwordHash));
    await db.loginAttempt.create({ data: { phone: data.phone, success: ok } });
    if (!ok || !user) return { error: "Telefone ou palavra-passe errados." };
    await createSession(user.id);
    next = data.next && data.next.startsWith("/") && !data.next.startsWith("//") ? data.next : user.role === "ADMIN" ? "/admin" : user.role === "ARTIST" ? "/artista" : "/";
  } catch (e) {
    return toActionError(e);
  }
  redirect(next);
}

