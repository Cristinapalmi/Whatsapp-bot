/**
 * Corre automaticamente em cada deploy na Vercel (script "vercel-build"), depois de criar
 * as tabelas e antes de construir o site:
 *   1. Cria/atualiza a conta de administração a partir de ADMIN_PHONE e ADMIN_PASSWORD.
 *   2. Apaga, uma única vez, as séries e contas de exemplo antigas (nunca dados reais).
 *   Online NUNCA cria séries de exemplo.
 * NUNCA faz o deploy falhar: se faltar alguma coisa, mostra um aviso e continua.
 */
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

  // Perdeu o telemóvel dos 2 passos? ADMIN_RESET_2FA=true + Redeploy volta a pedir a configuração.
  if (process.env.ADMIN_RESET_2FA === "true" && process.env.ADMIN_PHONE) {
    const { normalizeAngolanPhone } = await import("../src/lib/phone");
    const phone = normalizeAngolanPhone(process.env.ADMIN_PHONE);
    const dbr = new PrismaClient();
    try {
      if (phone) {
        const r = await dbr.user.updateMany({ where: { phone, role: "ADMIN" }, data: { totpEnabled: false, totpSecret: null, totpLastStep: null, totpRecoveryHashes: [] } });
        console.log(`[admin] 2 passos reiniciados (${r.count}). Apaga a variável ADMIN_RESET_2FA na Vercel.`);
      }
    } finally {
      await dbr.$disconnect().catch(() => {});
    }
  }

  // Segurança: RLS ativo em todas as tabelas (inclui tabelas novas de migrações futuras)
  const dbs = new PrismaClient();
  try {
    await dbs.$executeRawUnsafe(`DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename); END LOOP; END $$;`);
    console.log("[seguranca] RLS verificado em todas as tabelas.");
  } catch (e) {
    console.warn("[seguranca] Aviso: não consegui verificar o RLS:", e instanceof Error ? e.message : e);
  } finally {
    await dbs.$disconnect().catch(() => {});
  }

  // Online nunca se criam séries de exemplo (mesmo com SEED_DEMO=true).
  if (process.env.SEED_DEMO === "true") console.log("[seed] SEED_DEMO ignorado: o deploy online nunca cria séries de exemplo.");

  // Limpeza do demo antigo — corre uma única vez; não toca em dados reais.
  const db2 = new PrismaClient();
  try {
    const { runDemoCleanup } = await import("../src/domain/demo-cleanup");
    const r = await runDemoCleanup(db2);
    if (r.status === "done") console.log(`[demo] Séries de exemplo apagadas: ${r.counts.series} séries, ${r.counts.episodes} episódios, ${r.counts.users} contas de teste.`);
    else if (r.status === "blocked") console.log(`[demo] Limpeza em pausa: ${r.blockers.length} ligação(ões) de contas reais ao demo. Decide no Resumo do admin.`);
    else console.log("[demo] Nada para apagar.");
  } catch (e) {
    console.warn("[demo] Aviso: limpeza do demo não correu:", e instanceof Error ? e.message : e);
  } finally {
    await db2.$disconnect().catch(() => {});
  }
}

main()
  .catch((e) => console.warn("[bootstrap] Aviso:", e))
  .finally(() => process.exit(0));
