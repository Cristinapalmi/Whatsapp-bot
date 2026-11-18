import type { BannerSlide, PrismaClient } from "@prisma/client";

/**
 * BANNER DA PÁGINA INICIAL (Admin → Banner).
 * Cada slide: imagem OU vídeo curto (sem som, em loop, até 20 s e 8 MB), título, frase e botão.
 * O texto vai POR CIMA da imagem (nunca dentro dela).
 */
export const BANNER_VIDEO_MAX_BYTES = 8 * 1024 * 1024;
export const BANNER_VIDEO_MAX_SEC = 20;
export const CTA_KINDS = ["NONE", "SERIES", "CREATORS", "STORE", "LINK"] as const;
export type CtaKind = (typeof CTA_KINDS)[number];

/** Slides ativos agora (ativos e dentro das datas), pela ordem. */
export function activeSlides(db: PrismaClient, now = new Date()) {
  return db.bannerSlide.findMany({
    where: {
      active: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      OR: [{ imageKey: { not: null } }, { videoKey: { not: null } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Para onde leva o botão do slide. Só destinos internos. */
export function ctaHref(s: Pick<BannerSlide, "ctaKind" | "ctaTarget">): string | null {
  switch (s.ctaKind) {
    case "SERIES": return s.ctaTarget ? `/serie/${s.ctaTarget}` : null;
    case "CREATORS": return "/criadores";
    case "STORE": return "/loja";
    case "LINK": return s.ctaTarget && s.ctaTarget.startsWith("/") && !s.ctaTarget.startsWith("//") ? s.ctaTarget : null;
    default: return null;
  }
}

/**
 * Duração de um MP4 lida no próprio ficheiro (caixa "mvhd"), sem programas externos.
 * Devolve segundos ou null se não for um MP4 legível.
 */
export function mp4DurationSec(buf: Buffer): number | null {
  const idx = buf.indexOf("mvhd");
  if (idx < 4) return null;
  const version = buf[idx + 4];
  try {
    if (version === 1) {
      const timescale = buf.readUInt32BE(idx + 4 + 4 + 16);
      const duration = Number(buf.readBigUInt64BE(idx + 4 + 4 + 16 + 4));
      return timescale ? duration / timescale : null;
    }
    const timescale = buf.readUInt32BE(idx + 4 + 4 + 8);
    const duration = buf.readUInt32BE(idx + 4 + 4 + 8 + 4);
    return timescale ? duration / timescale : null;
  } catch {
    return null;
  }
}
