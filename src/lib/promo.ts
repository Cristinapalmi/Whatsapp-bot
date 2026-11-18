import "server-only";
import QRCode from "qrcode";
import { siteUrl } from "@config/brand";
import { getObjectUrl } from "@/domain/storage";

/** Link absoluto da capa (para gerar imagens no servidor). */
export async function absoluteCoverUrl(key: string | null) {
  if (!key) return null;
  const u = await getObjectUrl("media", key, 3600);
  return u.startsWith("/") ? `${siteUrl()}${u}` : u;
}

export const qrDataUrl = (text: string) => QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: "#1A0E05", light: "#FFFFFF" } });

/** Texto pronto para o artista colar no estado / stories. */
export function promoText(p: { title: string; hook?: string | null; link: string; brand: string; free: number }) {
  return `🎬 "${p.title}"${p.hook ? `\n${p.hook}` : ""}\n\nOs ${p.free} primeiros episódios são grátis. O resto está na ${p.brand} 👉 ${p.link}`;
}
