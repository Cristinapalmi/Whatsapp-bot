"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { createSession, hashPassword, needsRehash, recordAttempt, requestMeta, tooManyLoginAttempts, tooManyRegistrations, verifyPassword } from "@/lib/auth";
import { ageOn } from "@/lib/dates";
import { birthDateSchema, checkbox, formObject, passwordSchema, phoneSchema } from "@/lib/validation";
import { recordInviteOnSignup } from "@/domain/fans/invites";

/**
 * Entrar / criar conta SEM sair da página (janela que sobe de baixo).
 * Devolve { ok, next } — quem chamou continua onde estava (ex.: abre o episódio escolhido).
 */
export type QuickResult = { ok: true; next: string; fullReload?: boolean } | { ok: false; error: string };

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n.slice(0, 300) : "/");

const loginSchema = z.object({ phone: phoneSchema, password: z.string().min(1, "Indica a palavra-passe.").max(200) });

export async function quickLoginAction(fd: FormData): Promise<QuickResult> {
  try {
    const data = loginSchema.parse(formObject(fd));
    const { ip } = await requestMeta();
    if (await tooManyLoginAttempts(data.phone, ip)) return { ok: false, error: "Demasiadas tentativas. Espera 15 minutos e tenta outra vez." };
    const user = await db.user.findUnique({ where: { phone: data.phone } });
    const ok = !!user && !user.disabled && (await verifyPassword(data.password, user.passwordHash));
    await recordAttempt(data.phone, ip, "login", ok);
    if (!ok || !user) return { ok: false, error: "Telefone ou palavra-passe errados." };
    if (needsRehash(user.passwordHash)) await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.password) } });
    if (user.role === "ADMIN") {
      // Admin: 2.º passo obrigatório (página própria)
      await createSession(user.id, { admin: true, mfa: false });
      return { ok: true, next: user.totpEnabled ? "/entrar/2fa" : "/seguranca/2fa", fullReload: true };
    }
    await createSession(user.id);
    return { ok: true, next: safeNext(fd.get("next")) };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? e.issues[0]?.message ?? "Dados inválidos." : "Não foi possível entrar. Tenta outra vez." };
  }
}

const registerSchema = z.object({
  name: z.string().trim().max(60).optional(),
  phone: phoneSchema,
  password: passwordSchema,
  birthDate: birthDateSchema,
  terms: checkbox("Tens de aceitar os Termos e a Política de Privacidade."),
});

export async function quickRegisterAction(fd: FormData): Promise<QuickResult> {
  try {
    if (String(fd.get("website") ?? "") !== "") return { ok: false, error: "Não foi possível criar a conta." };
    const data = registerSchema.parse(formObject(fd));
    const meta = await requestMeta();
    const ip = meta.ip;
    if (await tooManyRegistrations(ip)) return { ok: false, error: "Foram criadas muitas contas a partir desta ligação. Tenta mais tarde." };
    if (ageOn(data.birthDate) < business.minAgePublic) return { ok: false, error: `Tens de ter pelo menos ${business.minAgePublic} anos para criar conta.` };
    if (await db.user.findUnique({ where: { phone: data.phone } })) return { ok: false, error: "Já existe uma conta com este número. Carrega em “Já tenho conta — Entrar”." };
    const jar = await cookies();
    const refId = jar.get("ref")?.value;
    const deviceId = jar.get("did")?.value?.slice(0, 64) ?? null;
    const inviteCode = jar.get("amigo")?.value?.slice(0, 16) ?? null;
    const referrer = refId ? await db.artistProfile.findFirst({ where: { id: refId, status: "APPROVED" }, select: { id: true } }) : null;
    const user = await db.user.create({
      data: {
        name: data.name && data.name.length >= 2 ? data.name : `Fã ${data.phone.slice(-3)}`,
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
        birthDate: data.birthDate,
        referredByArtistId: referrer?.id ?? null,
        signupDeviceId: deviceId,
        signupIp: ip,
        consents: {
          create: [
            { document: "TERMS", version: business.legalVersions.terms, ...meta },
            { document: "PRIVACY", version: business.legalVersions.privacy, ...meta },
          ],
        },
      },
    });
    await recordAttempt(data.phone, ip, "register", true);
    if (inviteCode) await recordInviteOnSignup(db, { inviteeId: user.id, code: inviteCode, deviceId, ip }).catch((e) => console.error("convite", e));
    await createSession(user.id);
    return { ok: true, next: safeNext(fd.get("next")) };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? e.issues[0]?.message ?? "Dados inválidos." : "Não foi possível criar a conta. Tenta outra vez." };
  }
}
