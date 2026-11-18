import type { Ad } from "@prisma/client";
import type { Tx } from "../money/ledger";

/**
 * CAMADA "AdProvider" — de onde vem o anúncio que o fã vê para desbloquear um episódio.
 *
 *  - "house" (ATIVO): anúncios da casa, carregados no admin (vídeo do patrocinador no Supabase).
 *  - "google-ad-manager" (DESLIGADO): para ligar mais tarde uma rede de anúncios com
 *    "rewarded ads" para web (ex.: Google Ad Manager / Google Publisher Tag). NÃO está
 *    implementado: exige conta aprovada na rede, código do bloco de anúncios e a
 *    confirmação de recompensa da própria rede. Ver docs/ANUNCIOS.md.
 *
 * Em ambos os casos, o desbloqueio só acontece quando o SERVIDOR confirma que o anúncio
 * foi visto até ao fim (ver service.ts → completeAdView).
 */
export type AdCreative = { adId: string; sponsor: string; title: string | null; videoKey: string; durationSec: number; linkUrl: string | null };

export interface AdProvider {
  id: string;
  label: string;
  enabled: boolean;
  /** Escolhe um anúncio para mostrar (ou null se não houver nenhum disponível). */
  pickAd(db: Tx, now: Date): Promise<AdCreative | null>;
}

export const houseAdProvider: AdProvider = {
  id: "house",
  label: "Anúncios da casa",
  enabled: true,
  async pickAd(db, now) {
    const ads: Ad[] = await db.ad.findMany({
      where: {
        active: true,
        videoKey: { not: null },
        durationSec: { gt: 0 },
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
    });
    if (ads.length === 0) return null;
    // O anúncio menos visto primeiro (reparte as visualizações pelos patrocinadores)
    const ad = ads.sort((a, b) => a.impressions - b.impressions)[0];
    return { adId: ad.id, sponsor: ad.sponsor, title: ad.title, videoKey: ad.videoKey!, durationSec: ad.durationSec, linkUrl: ad.linkUrl };
  },
};

export const googleAdManagerProvider: AdProvider = {
  id: "google-ad-manager",
  label: "Google Ad Manager (rewarded) — não configurado",
  enabled: false,
  async pickAd() {
    throw new Error("Rede de anúncios não configurada. Ver src/domain/ads/provider.ts e docs/ANUNCIOS.md.");
  },
};

/** Fornecedores ativos, por ordem de preferência. */
export const AD_PROVIDERS: AdProvider[] = [houseAdProvider, googleAdManagerProvider].filter((p) => p.enabled);
