import "server-only";
import { getObjectUrl } from "@/domain/storage";

/** Link para a capa de uma série ou foto de artista (ou null). */
export async function mediaUrl(key: string | null | undefined) {
  if (!key) return null;
  return getObjectUrl("media", key, 24 * 3600);
}
