/**
 * Corre automaticamente em cada deploy na Vercel (script "vercel-build"), depois de criar
 * as tabelas e antes de construir o site:
 *   1. Cria/atualiza a conta de administração a partir de ADMIN_PHONE e ADMIN_PASSWORD.
 *   2. Só se SEED_DEMO=true: cria as séries de exemplo (sem duplicar).
 * NUNCA faz o deploy falhar: se faltar alguma coisa, mostra um aviso e continua.
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.(".env");
} catch {}

async function main() {
  const { ensureAdmin } = await import("../src/domain/admin-bootstrap");
  const db = new PrismaClient();
  try {
    const r = await ensureAdmin(db, { phone: process.env.ADMIN_PHONE, password: process.env.ADMIN_PASSWORD });
    if (r.status === "skipped") console.log(`[admin] Conta de administração não criada: ${r.reason}.`);
    else console.log(`[admin] Conta de administração ${ { created: "criada", updated: "atualizada", unchanged: "já estava certa" }[r.status] } (${r.phone.slice(0, 7)}…).`);
  } catch (e) {
    console.warn("[admin] Aviso: não foi possível verificar a conta de administração:", e instanceof Error ? e.message : e);
  } finally {
    await db.$disconnect().catch(() => {});
  }

  if (process.env.SEED_DEMO === "true") {
    try {
      console.log("[seed] SEED_DEMO=true → a criar as séries de exemplo (se ainda não existirem)…");
      execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { stdio: "inherit", env: { ...process.env, SEED_DEMO: "true" } });
    } catch (e) {
      console.warn("[seed] Aviso: as séries de exemplo não foram criadas:", e instanceof Error ? e.message : e);
    }
  } else {
    console.log("[seed] Séries de exemplo não criadas (só com SEED_DEMO=true).");
  }
}

main()
  .catch((e) => console.warn("[bootstrap] Aviso:", e))
  .finally(() => process.exit(0));
