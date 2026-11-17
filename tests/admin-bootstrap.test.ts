import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resetTestDb } from "./helpers";
import { ensureAdmin } from "@/domain/admin-bootstrap";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
});
afterAll(async () => {
  await db.$disconnect();
});

describe("Conta de administração automática", () => {
  it("sem ADMIN_PHONE ou ADMIN_PASSWORD não faz nada (e não dá erro)", async () => {
    expect((await ensureAdmin(db, {})).status).toBe("skipped");
    expect((await ensureAdmin(db, { phone: "923000001" })).status).toBe("skipped");
    expect((await ensureAdmin(db, { password: "segredo-forte" })).status).toBe("skipped");
    expect(await db.user.count()).toBe(0);
  });

  it("recusa telefone inválido e palavra-passe curta", async () => {
    expect(await ensureAdmin(db, { phone: "12345", password: "segredo-forte" })).toMatchObject({ status: "skipped" });
    expect(await ensureAdmin(db, { phone: "923000001", password: "curta" })).toMatchObject({ status: "skipped" });
    expect(await db.user.count()).toBe(0);
  });

  it("cria uma vez e depois não duplica", async () => {
    expect(await ensureAdmin(db, { phone: "923 000 001", password: "segredo-forte" })).toEqual({ status: "created", phone: "+244923000001" });
    expect(await ensureAdmin(db, { phone: "+244923000001", password: "segredo-forte" })).toMatchObject({ status: "unchanged" });
    expect(await db.user.count({ where: { phone: "+244923000001" } })).toBe(1);
  });

  it("mudar ADMIN_PASSWORD na Vercel atualiza a palavra-passe", async () => {
    expect(await ensureAdmin(db, { phone: "923000001", password: "nova-palavra-passe" })).toMatchObject({ status: "updated" });
    const u = await db.user.findUniqueOrThrow({ where: { phone: "+244923000001" } });
    expect(await bcrypt.compare("nova-palavra-passe", u.passwordHash)).toBe(true);
  });

  it("promove uma conta existente com esse telefone sem apagar os dados dela", async () => {
    const fan = await db.user.create({ data: { name: "Ana", phone: "+244923000002", passwordHash: "x", birthDate: new Date("2000-01-01") } });
    await db.pointsTransaction.create({ data: { userId: fan.id, delta: 30, reason: "ADMIN_ADJUST" } });
    expect(await ensureAdmin(db, { phone: "923000002", password: "segredo-forte" })).toMatchObject({ status: "updated" });
    const u = await db.user.findUniqueOrThrow({ where: { id: fan.id }, include: { pointsTransactions: true } });
    expect(u.role).toBe("ADMIN");
    expect(u.name).toBe("Ana");
    expect(u.pointsTransactions).toHaveLength(1);
  });
});
