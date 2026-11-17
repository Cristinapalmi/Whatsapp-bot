import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeAngolanPhone } from "@/lib/phone";

/**
 * CONTA DE ADMINISTRAÇÃO AUTOMÁTICA (corre em cada deploy na Vercel).
 * Idempotente: cria a conta se não existir; se existir, garante que é admin e que a
 * palavra-passe é a de ADMIN_PASSWORD. Nunca apaga nada nem cria contas duplicadas.
 */
export type BootstrapResult =
  | { status: "skipped"; reason: string }
  | { status: "created" | "updated" | "unchanged"; phone: string };

export async function ensureAdmin(db: PrismaClient, env: { phone?: string; password?: string }): Promise<BootstrapResult> {
  const rawPhone = env.phone?.trim();
  const password = env.password ?? "";
  if (!rawPhone || !password) return { status: "skipped", reason: "ADMIN_PHONE ou ADMIN_PASSWORD não estão definidos" };
  const phone = normalizeAngolanPhone(rawPhone);
  if (!phone) return { status: "skipped", reason: `ADMIN_PHONE "${rawPhone}" não é um número angolano válido (ex.: 923456789)` };
  if (password.length < 8) return { status: "skipped", reason: "ADMIN_PASSWORD tem de ter pelo menos 8 caracteres" };

  const existing = await db.user.findUnique({ where: { phone } });
  if (!existing) {
    await db.user.create({
      data: { name: "Administração", phone, passwordHash: await bcrypt.hash(password, 10), birthDate: new Date("1990-01-01"), role: "ADMIN" },
    });
    return { status: "created", phone };
  }
  const samePassword = await bcrypt.compare(password, existing.passwordHash);
  if (existing.role === "ADMIN" && !existing.disabled && samePassword) return { status: "unchanged", phone };
  await db.user.update({
    where: { id: existing.id },
    data: { role: "ADMIN", disabled: false, ...(samePassword ? {} : { passwordHash: await bcrypt.hash(password, 10) }) },
  });
  return { status: "updated", phone };
}
