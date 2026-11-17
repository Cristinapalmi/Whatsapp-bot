import "server-only";
import type { Episode } from "@prisma/client";
import { getObjectUrl } from "../storage";

/**
 * ADAPTADOR DE VÍDEO.
 *
 * Fase 1 — "storage": ficheiros MP4 já comprimidos (360p e, opcionalmente, 480p)
 * guardados no armazenamento (Supabase Storage). Comando ffmpeg recomendado em docs/VIDEOS.md.
 *
 * Mais tarde — trocar VIDEO_PROVIDER para:
 *   "bunny"       → Bunny Stream (HLS automático, ~5–10 $/mês no início).
 *                   Credenciais: BUNNY_LIBRARY_ID, BUNNY_API_KEY, BUNNY_CDN_HOSTNAME, BUNNY_TOKEN_KEY.
 *   "cloudflare"  → Cloudflare Stream (HLS automático, cobra por minutos guardados e vistos).
 *                   Credenciais: CF_ACCOUNT_ID, CF_STREAM_API_TOKEN, CF_STREAM_SIGNING_KEY.
 * Nesses casos o campo Episode.videoKey guarda o ID do vídeo no serviço, e esta função
 * devolve o link HLS (.m3u8) assinado. NÃO estão implementados: ver docs/FASE-3.md.
 */

export type Quality = "low" | "medium";

export async function getPlaybackUrl(episode: Pick<Episode, "videoKey" | "videoKeyHd">, quality: Quality) {
  const provider = process.env.VIDEO_PROVIDER ?? "storage";
  if (provider !== "storage") throw new Error(`Fornecedor de vídeo "${provider}" ainda não implementado`);
  const key = quality === "medium" && episode.videoKeyHd ? episode.videoKeyHd : episode.videoKey;
  if (!key) return null;
  return getObjectUrl("media", key, 3 * 3600); // link válido 3 horas
}

export async function getSubtitlesUrl(episode: Pick<Episode, "subtitlesKey">) {
  return episode.subtitlesKey ? getObjectUrl("media", episode.subtitlesKey, 3 * 3600) : null;
}
