/**
 * PREPARAR E TESTAR O SUPABASE STORAGE (corre no teu computador, uma vez)
 *
 *   npm run storage:setup
 *
 * 1. Cria os 2 buckets privados, se ainda não existirem:
 *      - media   (vídeos, capas, trailers, fotos)   — até 50 MB por ficheiro
 *      - privado (comprovativos de pagamento)        — até 5 MB por ficheiro
 * 2. Faz um teste completo: guarda um ficheiro, cria um link temporário, abre-o,
 *    cria um link de envio direto (como o do admin para vídeos) e apaga tudo.
 *
 * Precisa no .env: STORAGE_DRIVER="supabase", SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
try {
  process.loadEnvFile?.(".env");
} catch {}

const BUCKETS = [
  { env: "SUPABASE_BUCKET_MEDIA", fallback: "media", limit: "50MB", mime: ["video/mp4", "video/webm", "image/jpeg", "image/png", "image/webp", "image/svg+xml", "text/vtt", "text/plain"] },
  { env: "SUPABASE_BUCKET_PRIVATE", fallback: "privado", limit: "5MB", mime: ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"] },
];

async function main() {
  if (process.env.STORAGE_DRIVER !== "supabase") {
    console.log('Atenção: no .env, STORAGE_DRIVER não é "supabase". O teste vai usar o Supabase na mesma.');
    process.env.STORAGE_DRIVER = "supabase";
  }
  const storage = await import("../src/domain/storage/core");
  const sb = storage.supabaseClient();

  console.log("1) Buckets");
  const { data: existing, error: listErr } = await sb.storage.listBuckets();
  if (listErr) throw new Error(`Não consegui ligar ao Supabase: ${listErr.message}. Confirma SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.`);
  for (const b of BUCKETS) {
    const id = process.env[b.env] || b.fallback;
    const found = existing?.find((x) => x.id === id);
    if (found) {
      if (found.public) console.log(`   ! O bucket "${id}" está PÚBLICO. Muda-o para privado no Supabase (Storage → bucket → Edit).`);
      else console.log(`   ✓ "${id}" já existe (privado)`);
      continue;
    }
    const { error } = await sb.storage.createBucket(id, { public: false, fileSizeLimit: b.limit, allowedMimeTypes: b.mime });
    if (error) throw new Error(`Não consegui criar o bucket "${id}": ${error.message}`);
    console.log(`   ✓ "${id}" criado (privado, até ${b.limit} por ficheiro)`);
  }

  console.log("2) Teste de envio, leitura e apagar");
  for (const bucket of ["media", "private"] as const) {
    const key = `teste/${Date.now()}.txt`;
    await storage.putObject(bucket, key, Buffer.from("ola"), "text/plain");
    const url = await storage.getObjectUrl(bucket, key, 60);
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok || text !== "ola") throw new Error(`Leitura falhou no bucket ${storage.bucketIdFor(bucket)} (HTTP ${res.status})`);
    const up = await storage.getUploadUrl(bucket, `teste/${Date.now()}-envio.txt`, "text/plain");
    const put = await fetch(up, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "envio" });
    if (!put.ok) throw new Error(`Envio direto falhou no bucket ${storage.bucketIdFor(bucket)} (HTTP ${put.status}): ${await put.text()}`);
    const { data: files } = await sb.storage.from(storage.bucketIdFor(bucket)).list("teste");
    await sb.storage.from(storage.bucketIdFor(bucket)).remove((files ?? []).map((f) => `teste/${f.name}`));
    console.log(`   ✓ "${storage.bucketIdFor(bucket)}": guardar, link temporário, envio direto e apagar — tudo a funcionar`);
  }
  console.log("\nSupabase Storage pronto.");
}

main().catch((e) => {
  console.error("\nErro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
