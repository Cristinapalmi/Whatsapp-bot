import { PrismaClient } from "@prisma/client";

// Uma única ligação à base de dados reutilizada (evita esgotar ligações em desenvolvimento).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = PrismaClient;
