import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * ARMAZENAMENTO DE FICHEIROS (vídeos, capas, fotos, comprovativos).
 *
 *  STORAGE_DRIVER=local → pasta ./storage no computador (só para desenvolvimento).
 *  STORAGE_DRIVER=s3    → Cloudflare R2 (ou qualquer serviço compatível com S3).
 *
 * Há dois "baldes":
 *  - "media":   vídeos, capas e fotos de artistas.
 *  - "private": comprovativos de pagamento (só a administração vê).
 * Todos os ficheiros são privados: o acesso é sempre por links temporários assinados.
 */

export type Bucket = "media" | "private";

const driver = () => (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3";

// ---------- S3 / Cloudflare R2 ----------
let s3: S3Client | null = null;
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

export async function signLocalToken(payload: { b: Bucket; k: string; op: "get" | "put"; ct?: string }, seconds: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${seconds}s`).sign(tokenSecret());
}
export async function verifyLocalToken(token: string) {
  const { payload } = await jwtVerify(token, tokenSecret());
  return payload as { b: Bucket; k: string; op: "get" | "put"; ct?: string };
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
  await s3Client().send(new PutObjectCommand({ Bucket: bucketName(b), Key: key, Body: data, ContentType: contentType }));
}

/** Link temporário para ver/descarregar um ficheiro. */
export async function getObjectUrl(b: Bucket, key: string, expiresSeconds = 3600) {
  // Ficheiros estáticos de exemplo (pasta /public) — ex.: "/samples/demo.mp4"
  if (key.startsWith("/")) return key;
  if (driver() === "local") return `/api/files?t=${await signLocalToken({ b, k: key, op: "get" }, expiresSeconds)}`;
  return getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: bucketName(b), Key: key }), { expiresIn: expiresSeconds });
}

/**
 * Link temporário para o NAVEGADOR enviar um ficheiro grande diretamente para o
 * armazenamento (ex.: vídeos), sem passar pelo servidor (a Vercel limita a 4,5 MB).
 */
export async function getUploadUrl(b: Bucket, key: string, contentType: string, expiresSeconds = 3600) {
  if (driver() === "local")
    return `/api/files/upload?t=${await signLocalToken({ b, k: key, op: "put", ct: contentType }, expiresSeconds)}`;
  return getSignedUrl(
    s3Client(),
    new PutObjectCommand({ Bucket: bucketName(b), Key: key, ContentType: contentType }),
    { expiresIn: expiresSeconds },
  );
}

export async function deleteObject(b: Bucket, key: string) {
  if (key.startsWith("/")) return;
  if (driver() === "local") return fs.rm(localPath(b, key), { force: true });
  await s3Client().send(new DeleteObjectCommand({ Bucket: bucketName(b), Key: key }));
}

export const sha256 = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");
