"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, getSession, recordAttempt, requestMeta, tooManyLoginAttempts } from "@/lib/auth";
import { generateRecoveryCodes, hashRecoveryCode, verifyTotp } from "@/lib/totp";
import { audit } from "@/domain/notify";
import type { ActionResult } from "@/components/ActionForm";

const codeSchema = z.string().trim().min(6, "Escreve o código.").max(20);

/** Configurar: confirmar o primeiro código da app de autenticação. */
export async function enableTotpAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s || s.user.role !== "ADMIN") redirect("/entrar");
  if (s.user.totpEnabled && !s.mfa) redirect("/entrar/2fa");
  const code = codeSchema.safeParse(fd.get("code"));
  if (!code.success || !s.user.totpSecret) return { error: "Escreve o código de 6 dígitos da app." };
  const step = verifyTotp(s.user.totpSecret, code.data);
  if (step === null) return { error: "Código errado. Confirma a hora do telemóvel e tenta outra vez." };
  const { codes, hashes } = generateRecoveryCodes();
  await db.user.update({ where: { id: s.user.id }, data: { totpEnabled: true, totpLastStep: step, totpRecoveryHashes: hashes } });
  await audit(db, s.user.id, "ADMIN_2FA_ENABLED", "User", s.user.id);
  await createSession(s.user.id, { admin: true, mfa: true });
  // Mostrar os códigos de recuperação UMA vez (cookie seguro de 10 minutos, apagado ao ver)
  (await cookies()).set("rc", codes.join(","), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/seguranca", maxAge: 600 });
  redirect("/seguranca/2fa/codigos");
}

/** Entrar: 2.º passo (código da app ou código de recuperação). */
export async function verifyTotpAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s || s.user.role !== "ADMIN") redirect("/entrar");
  if (!s.user.totpEnabled || !s.user.totpSecret) redirect("/seguranca/2fa");
  const { ip } = await requestMeta();
  if (await tooManyLoginAttempts(s.user.phone, ip, "2fa")) return { error: "Demasiadas tentativas. Espera 15 minutos." };
  const parsed = codeSchema.safeParse(fd.get("code"));
  if (!parsed.success) return { error: "Escreve o código." };
  const code = parsed.data;
  let ok = false;
  const step = verifyTotp(s.user.totpSecret, code, { lastStep: s.user.totpLastStep });
  if (step !== null) {
    await db.user.update({ where: { id: s.user.id }, data: { totpLastStep: step } });
    ok = true;
  } else if (/[a-z]/i.test(code)) {
    const h = hashRecoveryCode(code);
    if (s.user.totpRecoveryHashes.includes(h)) {
      await db.user.update({ where: { id: s.user.id }, data: { totpRecoveryHashes: s.user.totpRecoveryHashes.filter((x) => x !== h) } });
      await audit(db, s.user.id, "ADMIN_2FA_RECOVERY_CODE_USED", "User", s.user.id);
      ok = true;
    }
  }
  await recordAttempt(s.user.phone, ip, "2fa", ok);
  if (!ok) return { error: "Código errado." };
  await createSession(s.user.id, { admin: true, mfa: true });
  redirect("/admin");
}

export async function clearRecoveryCookieAction() {
  (await cookies()).delete({ name: "rc", path: "/seguranca" });
}
