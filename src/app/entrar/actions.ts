"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, needsRehash, recordAttempt, requestMeta, tooManyLoginAttempts, verifyPassword } from "@/lib/auth";
import { formObject, phoneSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import type { ActionResult } from "@/components/ActionForm";

const schema = z.object({ phone: phoneSchema, password: z.string().min(1, "Indica a palavra-passe.").max(200), next: z.string().max(300).optional() });

export async function loginAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let next = "/";
  try {
    const data = schema.parse(formObject(fd));
    const { ip } = await requestMeta();
    if (await tooManyLoginAttempts(data.phone, ip)) return { error: "Demasiadas tentativas. Espera 15 minutos e tenta outra vez." };
    const user = await db.user.findUnique({ where: { phone: data.phone } });
    const ok = !!user && !user.disabled && (await verifyPassword(data.password, user.passwordHash));
    await recordAttempt(data.phone, ip, "login", ok);
    if (!ok || !user) return { error: "Telefone ou palavra-passe errados." };
    // Hashes antigos (mais fracos) são atualizados sem a pessoa dar por isso
    if (needsRehash(user.passwordHash)) await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.password) } });

    if (user.role === "ADMIN") {
      // Admin: sessão curta e 2.º passo obrigatório antes de entrar no painel
      await createSession(user.id, { admin: true, mfa: false });
      next = user.totpEnabled ? "/entrar/2fa" : "/seguranca/2fa";
    } else {
      await createSession(user.id);
      next = data.next && data.next.startsWith("/") && !data.next.startsWith("//") ? data.next : user.role === "ARTIST" ? "/artista" : "/";
    }
  } catch (e) {
    return toActionError(e);
  }
  redirect(next);
}
