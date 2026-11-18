/**
 * REGRAS DE NEGÓCIO configuráveis (preços, percentagens, limites, dados de pagamento).
 * Todos os valores de dinheiro estão em KWANZAS inteiros aqui; internamente a app
 * converte para cêntimos para não haver erros de arredondamento.
 */

const env = (key: string, fallback: string) => {
  const v = process.env[key];
  return v && v.trim().length > 0 ? v.trim() : fallback;
};
const envInt = (key: string, fallback: number) => {
  const n = Number.parseInt(env(key, String(fallback)), 10);
  return Number.isFinite(n) ? n : fallback;
};

export const business = {
  /** Percentagem do artista sobre o que o público paga (depois de comissões). */
  artistSharePercent: envInt("ARTIST_SHARE_PERCENT", 50),
  /** Limites de preço por episódio (Kz). */
  episodePriceMinKz: 50,
  episodePriceMaxKz: 150,
  /** Preço do passe semanal (Kz) — Fase 2. */
  weeklyPassPriceKz: envInt("WEEKLY_PASS_PRICE_KZ", 300),
  /** Levantamento mínimo do artista (Kz). */
  minWithdrawalKz: envInt("MIN_WITHDRAWAL_KZ", 5000),
  /** Máximo de pedidos de pagamento "a aguardar confirmação" por utilizador. */
  maxPendingPaymentsPerUser: envInt("MAX_PENDING_PAYMENTS_PER_USER", 3),
  /** Idade mínima do público e dos artistas. */
  minAgePublic: 16,
  minAgeArtist: 18,
  /** Dados que aparecem no ecrã de pagamento manual. */
  manualPayment: {
    multicaixaExpressNumber: env("PAYMENT_MCX_NUMBER", "9XX XXX XXX"),
    iban: env("PAYMENT_IBAN", "AO06 0000 0000 0000 0000 0000 0"),
    accountHolder: env("PAYMENT_ACCOUNT_HOLDER", "Nome do titular da conta"),
    bankName: env("PAYMENT_BANK_NAME", "Banco"),
  },
  /**
   * Interruptores de venda. Desligados = o código e os dados ficam, mas não se vende.
   *  - weeklyPassSales: passe semanal (desligado até definirmos como pagar os criadores em acesso ilimitado)
   *  - kzEpisodeSales / kzGiftSales: compra de episódios e presentes diretamente em Kz (substituída pelas moedas)
   */
  features: {
    weeklyPassSales: false,
    kzEpisodeSales: false,
    kzGiftSales: false,
  },
  /** Duração do passe semanal (dias). */
  weeklyPassDays: 7,
  /** Presentes para os artistas (valor em Kz). 50% vai para o artista. */
  gifts: [
    { id: "CUCA", label: "Cuca", priceKz: 50 },
    { id: "MUAMBA", label: "Muamba", priceKz: 100 },
    { id: "CANDONGA", label: "Candonga", priceKz: 200 },
    { id: "GRADE", label: "Grade", priceKz: 500 },
  ],
  /** Pontos de fã — SEM valor em dinheiro. */
  points: {
    perCompletedEpisode: 10,
    /** Pontos necessários para desbloquear 1 episódio. */
    costPerEpisode: 100,
  },
  /** Versões dos documentos legais. Mudar a versão obriga a nova aceitação. */
  legalVersions: {
    terms: "2026-11-v3",
    privacy: "2026-11-v1",
    artistPolicy: "2026-11-v4",
  },
} as const;
