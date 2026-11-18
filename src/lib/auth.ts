import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";

/**
 * Autenticação: telefone + palavra-passe. A sessão fica num cookie seguro (httpOnly),
 * assinado com SESSION_SECRET.
 * - Fãs e artistas: sessão de 30 dias.
 * - Administração: sessão de 12 horas e só dá acesso ao admin depois do 2.º passo (TOTP).
 */

const COOKIE = "sid";
const SESSION_DAYS = 30;
export const ADMIN_SESSION_HOURS = 12;
/** Custo do hash das palavras-passe (bcrypt). Hashes antigos são atualizados no login. */
const BCRYPT_COST = 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET em falta ou demasiado curto (mín. 32 caracteres)");
  return new TextEncoder().encode(s);
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const needsRehash = (hash: string) => {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST;
  } catch {
    return true;
  }
};

export async function createSession(userId: string, opts: { admin?: boolean; mfa?: boolean } = {}) {
  const seconds = opts.admin ? ADMIN_SESSION_HOURS * 3600 : SESSION_DAYS * 24 * 3600;
  const token = await new SignJWT({ uid: userId, mfa: !!opts.mfa })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: seconds,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Sessão atual: utilizador e se o 2.º passo (TOTP) foi feito. Lido uma vez por pedido. */
export const getSession = cache(async (): Promise<{ user: User; mfa: boolean } | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const uid = typeof payload.uid === "string" ? payload.uid : null;
    if (!uid) return null;
    const user = await db.user.findUnique({ where: { id: uid } });
    if (!user || user.disabled) return null;
    return { user, mfa: payload.mfa === true };
  } catch {
    return null;
  }
});

export const getCurrentUser = cache(async (): Promise<User | null> => (await getSession())?.user ?? null);

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireRole(role: Role): Promise<User> {
  if (role === "ADMIN") return requireAdmin();
  const user = await requireUser();
  if (user.role !== role && user.role !== "ADMIN") redirect("/");
  return user;
}

/** Admin com o 2.º passo feito. Sem 2 passos configurados → página de configuração. */
export async function requireAdmin(): Promise<User> {
  const s = await getSession();
  if (!s) redirect("/entrar?next=/admin");
  if (s.user.role !== "ADMIN") redirect("/");
  if (!s.user.totpEnabled) redirect("/seguranca/2fa");
  if (!s.mfa) redirect("/entrar/2fa");
  return s.user;
}

/** Para rotas (CSV, etc.): devolve a admin só se tiver feito o 2.º passo. */
export async function getAdminForApi(): Promise<User | null> {
  const s = await getSession();
  return s && s.user.role === "ADMIN" && s.user.totpEnabled && s.mfa ? s.user : null;
}

/** IP e navegador — guardados com consentimentos e tentativas de entrada. */
export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/**
 * Limite de tentativas falhadas: 5 por telefone em 15 min, ou 30 por IP em 15 min
 * (o limite por IP é largo porque em Angola muitas pessoas partilham o mesmo IP da operadora).
 */
export async function tooManyLoginAttempts(phone: string, ip: string | null, kind = "login") {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [byPhone, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { phone, kind, success: false, createdAt: { gte: since } } }),
    ip ? db.loginAttempt.count({ where: { ip, kind, success: false, createdAt: { gte: since } } }) : 0,
  ]);
  return byPhone >= 5 || byIp >= 30;
}

/** Proteção contra criação de contas em massa: no máximo 15 contas por IP por hora. */
export async function tooManyRegistrations(ip: string | null) {
  if (!ip) return false;
  const since = new Date(Date.now() - 3600 * 1000);
  return (await db.loginAttempt.count({ where: { ip, kind: "register", success: true, createdAt: { gte: since } } })) >= 15;
}

export async function recordAttempt(phone: string, ip: string | null, kind: string, success: boolean) {
  await db.loginAttempt.create({ data: { phone, ip, kind, success } });
}
