import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ARMAZENAMENTO DE FICHEIROS (vídeos, capas, fotos, comprovativos).
 *
 *  STORAGE_DRIVER=local    → pasta ./storage no computador (só para desenvolvimento).
 *  STORAGE_DRIVER=supabase → Supabase Storage (recomendado online — não precisa de cartão).
 *  STORAGE_DRIVER=s3       → Cloudflare R2 (ou outro serviço compatível com S3), opcional.
 *
 * Há dois "baldes" (buckets), ambos PRIVADOS:
 *  - "media":   vídeos, capas, legendas, trailers e fotos de artistas.
 *  - "private": comprovativos de pagamento (só a administração vê).
 * Todos os ficheiros são privados: o acesso é sempre por links temporários assinados.
 */

export type Bucket = "media" | "private";

const driver = () => (process.env.STORAGE_DRIVER ?? "local") as "local" | "supabase" | "s3";

// ---------- Supabase Storage ----------
let supabase: SupabaseClient | null = null;
function supabaseClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase Storage não configurado: faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");
    // Chave secreta: só é usada no servidor, nunca chega ao navegador.
    supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return supabase;
}
const supabaseBucket = (b: Bucket) =>
  b === "media" ? process.env.SUPABASE_BUCKET_MEDIA || "media" : process.env.SUPABASE_BUCKET_PRIVATE || "privado";

/** Só para testes: obriga a recriar o cliente (ex.: depois de mudar variáveis). */
export function resetStorageClientsForTests() {
  supabase = null;
  s3 = null;
}

// ---------- S3 / Cloudflare R2 ----------
let s3: S3Client | null = null;
export const bucketIdFor = (b: Bucket) => (driver() === "supabase" ? supabaseBucket(b) : b);
export { supabaseClient };
function s3Client() {
  if (!s3) {
    const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
    if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY)
      throw new Error("Armazenamento S3/R2 não configurado (ver .env.example)");
    s3 = new S3Client({
      region: S3_REGION || "auto",
      endpoint: S3_ENDPOINT,
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    });
  }
  return s3;
}
const bucketName = (b: Bucket) => {
  const name = b === "media" ? process.env.S3_BUCKET_MEDIA : process.env.S3_BUCKET_PRIVATE;
  if (!name) throw new Error(`Nome do balde "${b}" em falta (S3_BUCKET_MEDIA / S3_BUCKET_PRIVATE)`);
  return name;
};

// ---------- Local ----------
const LOCAL_ROOT = path.join(process.cwd(), "storage");
const localPath = (b: Bucket, key: string) => {
  const p = path.normalize(path.join(LOCAL_ROOT, b, key));
  if (!p.startsWith(path.join(LOCAL_ROOT, b))) throw new Error("Caminho inválido");
  return p;
};
const tokenSecret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-dev-secret-dev-secret!!");

export async function signLocalToken(payload: { b: Bucket; k: string; op: "get" | "put"; ct?: string; dl?: string }, seconds: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${seconds}s`).sign(tokenSecret());
}
export async function verifyLocalToken(token: string) {
  const { payload } = await jwtVerify(token, tokenSecret());
  return payload as { b: Bucket; k: string; op: "get" | "put"; ct?: string; dl?: string };
}
export async function readLocal(b: Bucket, key: string) {
  return fs.readFile(localPath(b, key));
}
export async function writeLocal(b: Bucket, key: string, data: Buffer) {
  const p = localPath(b, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

// ---------- API comum ----------

/** Gera uma chave única, ex.: proofs/2026/11/abc123.jpg */
export function newKey(prefix: string, ext: string) {
  const d = new Date();
  const month = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${prefix}/${month}/${crypto.randomUUID()}.${ext.replace(/^\./, "")}`;
}

export async function putObject(b: Bucket, key: string, data: Buffer, contentType: string) {
  if (driver() === "local") return writeLocal(b, key, data);
  if (driver() === "supabase") {
    const { error } = await supabaseClient().storage.from(supabaseBucket(b)).upload(key, data, { contentType, upsert: false });
    if (error) throw new Error(`Erro ao guardar ficheiro no Supabase: ${error.message}`);
    return;
  }
  await s3Client().send(new PutObjectCommand({ Bucket: bucketName(b), Key: key, Body: data, ContentType: contentType }));
}

/**
 * Link temporário para ver/descarregar um ficheiro.
 * Com `downloadName`, o navegador descarrega o ficheiro com esse nome em vez de o abrir.
 */
export async function getObjectUrl(b: Bucket, key: string, expiresSeconds = 3600, opts: { downloadName?: string } = {}) {
  // Ficheiros estáticos de exemplo (pasta /public) — ex.: "/samples/demo.mp4"
  if (key.startsWith("/")) return key;
  if (driver() === "local")
    return `/api/files?t=${await signLocalToken({ b, k: key, op: "get", dl: opts.downloadName }, expiresSeconds)}`;
  if (driver() === "supabase") {
    const { data, error } = await supabaseClient()
      .storage.from(supabaseBucket(b))
      .createSignedUrl(key, expiresSeconds, opts.downloadName ? { download: opts.downloadName } : undefined);
    if (error || !data) throw new Error(`Erro ao criar link do ficheiro no Supabase: ${error?.message ?? "sem dados"}`);
    return data.signedUrl;
  }
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: bucketName(b),
      Key: key,
      ...(opts.downloadName ? { ResponseContentDisposition: `attachment; filename="${opts.downloadName.replace(/"/g, "")}"` } : {}),
    }),
    { expiresIn: expiresSeconds },
  );
}

/** Caminho no disco de um ficheiro guardado localmente (só STORAGE_DRIVER=local). */
export const localFilePath = (b: Bucket, key: string) => localPath(b, key);
export const storageDriver = driver;

/**
 * Link temporário para o NAVEGADOR enviar um ficheiro grande diretamente para o
 * armazenamento (ex.: vídeos), sem passar pelo servidor (a Vercel limita a 4,5 MB).
 */
export async function getUploadUrl(b: Bucket, key: string, contentType: string, expiresSeconds = 3600) {
  if (driver() === "local")
    return `/api/files/upload?t=${await signLocalToken({ b, k: key, op: "put", ct: contentType }, expiresSeconds)}`;
  if (driver() === "supabase") {
    // Link de envio do Supabase (válido 2 horas). O navegador faz PUT do ficheiro para este link.
    const { data, error } = await supabaseClient().storage.from(supabaseBucket(b)).createSignedUploadUrl(key);
    if (error || !data) throw new Error(`Erro ao criar link de envio no Supabase: ${error?.message ?? "sem dados"}`);
    return data.signedUrl;
  }
  return getSignedUrl(
    s3Client(),
    new PutObjectCommand({ Bucket: bucketName(b), Key: key, ContentType: contentType }),
    { expiresIn: expiresSeconds },
  );
}

export async function deleteObject(b: Bucket, key: string) {
  if (key.startsWith("/")) return;
  if (driver() === "local") return fs.rm(localPath(b, key), { force: true });
  if (driver() === "supabase") {
    const { error } = await supabaseClient().storage.from(supabaseBucket(b)).remove([key]);
    if (error) throw new Error(`Erro ao apagar ficheiro no Supabase: ${error.message}`);
    return;
  }
  await s3Client().send(new DeleteObjectCommand({ Bucket: bucketName(b), Key: key }));
}

export const sha256 = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");
