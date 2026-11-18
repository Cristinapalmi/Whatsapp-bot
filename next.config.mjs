/** @type {import('next').NextConfig} */

// Endereços de armazenamento permitidos (Supabase Storage / R2) para imagens, vídeos e envios
const hostOf = (u) => {
  try {
    return u ? new URL(u).host : null;
  } catch {
    return null;
  }
};
const storageHosts = [hostOf(process.env.SUPABASE_URL), hostOf(process.env.S3_ENDPOINT)].filter(Boolean).map((h) => `https://${h}`).join(" ");
const isDev = process.env.NODE_ENV !== "production";

/**
 * CABEÇALHOS DE SEGURANÇA
 * - CSP: só carrega scripts, estilos, imagens e vídeos do próprio site e do armazenamento.
 *   ('unsafe-inline' nos scripts é necessário para o Next.js funcionar sem nonces.)
 * - HSTS: obriga a usar HTTPS. X-Frame-Options/frame-ancestors: impede pôr o site dentro de outro.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${storageHosts}`,
  `media-src 'self' blob: ${storageHosts}`,
  `connect-src 'self' ${storageHosts}`,
  "font-src 'self' data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const ocrFiles = [
  "./node_modules/tesseract.js/**/*",
  "./node_modules/tesseract.js-core/*",
  ...["bmp-js", "idb-keyval", "is-electron", "is-url", "node-fetch", "regenerator-runtime", "wasm-feature-detect", "zlibjs", "whatwg-url", "tr46", "webidl-conversions"].map((m) => `./node_modules/${m}/**/*`),
  "./node_modules/@tesseract.js-data/por/4.0.0_best_int/**/*",
];

const nextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }, // comprovativos e capas até 5 MB
  },
  images: { unoptimized: true }, // poupa custos de otimização de imagens na Vercel
  // Leitura de texto dos comprovativos (OCR): corre no servidor com os ficheiros do pacote
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  outputFileTracingIncludes: {
    "/pagar": ocrFiles,
    "/ver/[id]": ocrFiles,
    "/admin/pagamentos": ocrFiles,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
