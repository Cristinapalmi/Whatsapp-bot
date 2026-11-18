/**
 * Descobre o tipo REAL de um ficheiro pelos primeiros bytes ("assinatura"),
 * em vez de confiar no nome ou no tipo que o navegador diz.
 */
export type RealType = "jpeg" | "png" | "webp" | "pdf" | "mp4" | "webm" | "vtt" | null;

export function sniff(bytes: Uint8Array): RealType {
  const b = bytes;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (b.length >= 5 && ascii(0, 5) === "%PDF-") return "pdf";
  if (b.length >= 12 && ascii(4, 8) === "ftyp") return "mp4";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  const start = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0; // BOM
  if (b.length >= start + 6 && ascii(start, start + 6) === "WEBVTT") return "vtt";
  return null;
}

export const IMAGE_TYPES: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const VIDEO_TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm" };

/** Valida um ficheiro enviado pelo formulário: tipo real permitido e tamanho máximo. */
export async function readValidatedFile(file: File, allowed: RealType[], maxBytes: number, label: string) {
  if (file.size > maxBytes) throw new Error(`${label}: o ficheiro tem ${(file.size / 1048576).toFixed(1)} MB; o máximo é ${Math.round(maxBytes / 1048576)} MB.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes.subarray(0, 32));
  if (!type || !allowed.includes(type)) throw new Error(`${label}: tipo de ficheiro não permitido.`);
  return { bytes, type };
}

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
