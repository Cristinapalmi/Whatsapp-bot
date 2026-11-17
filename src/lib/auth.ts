import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";

/**
 * Autenticação simples: telefone + palavra-passe.
 * A sessão fica num cookie seguro (httpOnly), assinado com SESSION_SECRET.
 * Fase seguinte: código por SMS/WhatsApp (OTP) — ver docs/FASE-3.md.
 */

const COOKIE = "sid";
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET em falta ou demasiado curto (mín. 32 caracteres)");
  return new TextEncoder().encode(s);
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Utilizador com sessão iniciada (ou null). Lido uma vez por pedido. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = typeof payload.uid === "string" ? payload.uid : null;
    if (!uid) return null;
    const user = await db.user.findUnique({ where: { id: uid } });
    if (!user || user.disabled) return null;
    return user;
  } catch {
    return null;
  }
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireRole(role: Role): Promise<User> {
  const user = await requireUser();
  if (user.role !== role && user.role !== "ADMIN") redirect("/");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** IP e navegador — guardados com cada consentimento como prova. */
export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/** Bloqueia tentativas repetidas de entrar (5 falhas em 15 minutos). */
export async function tooManyLoginAttempts(phone: string) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const fails = await db.loginAttempt.count({ where: { phone, success: false, createdAt: { gte: since } } });
  return fails >= 5;
}
