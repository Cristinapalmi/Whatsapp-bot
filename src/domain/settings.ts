import type { Tx } from "./money/ledger";

/**
 * Regras numéricas editáveis no admin (sem mexer no código).
 * Cada uma tem um valor por defeito; o admin só grava as que muda.
 */
export type IntSetting = { key: string; label: string; hint?: string; def: number; min: number; max: number; group: string };

export const INT_SETTINGS = [
  // Preços e níveis
  { group: "precos", key: "tierPriceEntry", label: "Entrada (moedas por episódio)", def: 10, min: 1, max: 1000 },
  { group: "precos", key: "tierPriceNormal", label: "Normal ⭐ (moedas por episódio)", def: 20, min: 1, max: 1000 },
  { group: "precos", key: "tierPricePremium", label: "Premium 💎 (moedas por episódio)", def: 30, min: 1, max: 1000 },
  { group: "precos", key: "tierUpgradeUnlocks", label: "Desbloqueios pagos para subir a Normal", def: 100, min: 1, max: 100000 },
  { group: "precos", key: "seasonDiscountPercent", label: "Desconto da temporada (%)", def: 20, min: 0, max: 90 },
  // Oferta de boas-vindas (só para quem nunca comprou moedas)
  { group: "ofertas", key: "welcomePackKz", label: "Pacote da oferta de boas-vindas (Kz)", hint: "Tem de existir um pacote ativo com este preço.", def: 1000, min: 100, max: 1000000 },
  { group: "ofertas", key: "welcomeBonusCoins", label: "Moedas extra da oferta", def: 50, min: 1, max: 100000 },
  { group: "ofertas", key: "welcomeOfferHours", label: "Duração da oferta (horas)", def: 24, min: 1, max: 720 },
  // Artistas: Fundadores, marcos, levantamentos, convites
  { group: "artistas", key: "foundersLimit", label: "Vagas de Artista Fundador", def: 20, min: 0, max: 1000 },
  { group: "artistas", key: "founderMonths", label: "Meses com a parte maior (Fundador)", def: 3, min: 0, max: 36 },
  { group: "artistas", key: "founderSharePercent", label: "Parte do Fundador nesses meses (%)", def: 70, min: 1, max: 100 },
  { group: "artistas", key: "milestone1Unlocks", label: "Marco 1: desbloqueios pagos", def: 500, min: 1, max: 10000000 },
  { group: "artistas", key: "milestone1BonusKz", label: "Marco 1: bónus (Kz)", def: 2500, min: 0, max: 10000000 },
  { group: "artistas", key: "milestone2Unlocks", label: "Marco 2: desbloqueios pagos", def: 1000, min: 1, max: 10000000 },
  { group: "artistas", key: "milestone2BonusKz", label: "Marco 2: bónus (Kz)", def: 5000, min: 0, max: 10000000 },
  { group: "artistas", key: "milestone3Unlocks", label: "Marco 3 (👑): desbloqueios pagos", def: 5000, min: 1, max: 10000000 },
  { group: "artistas", key: "milestone3BonusKz", label: "Marco 3 (👑): bónus (Kz)", def: 25000, min: 0, max: 10000000 },
  { group: "artistas", key: "payoutFirstMinKz", label: "1.º levantamento: mínimo (Kz)", def: 1000, min: 1, max: 10000000 },
  { group: "artistas", key: "payoutMinKz", label: "Levantamentos seguintes: mínimo (Kz)", def: 5000, min: 1, max: 10000000 },
  { group: "artistas", key: "artistReferralBonusKz", label: "“Traz um kamba”: bónus por artista convidado (Kz)", def: 2000, min: 0, max: 10000000 },
  { group: "artistas", key: "tiktokViewsPerUnlock", label: "Comparação: 1 desbloqueio ≈ quantas visualizações no TikTok", def: 500, min: 1, max: 1000000 },
  // Fãs: convites, presença, embaixador (pontos não são dinheiro)
  { group: "fas", key: "inviteWatchPoints", label: "Convite: pontos para cada um quando o amigo vê e volta", def: 50, min: 0, max: 10000 },
  { group: "fas", key: "invitePurchasePoints", label: "Convite: pontos quando o amigo faz a 1.ª compra", def: 200, min: 0, max: 100000 },
  { group: "fas", key: "invitePendingHours", label: "Convite: horas em espera antes de dar os pontos", def: 48, min: 0, max: 720 },
  { group: "fas", key: "inviteExpireDays", label: "Convite: dias para o amigo voltar (senão não conta)", def: 14, min: 1, max: 365 },
  { group: "fas", key: "inviteMonthlyLimit", label: "Convites com prémio por mês (por pessoa)", def: 10, min: 0, max: 1000 },
  { group: "fas", key: "ambassadorInvites", label: "Convites válidos para ser Embaixador", def: 5, min: 1, max: 1000 },
  { group: "fas", key: "dailyPresencePoints", label: "Pontos de presença por dia", def: 5, min: 0, max: 1000 },
  { group: "fas", key: "streakDays", label: "Dias seguidos para o bónus", def: 7, min: 2, max: 365 },
  { group: "fas", key: "streakBonusPoints", label: "Bónus de dias seguidos (pontos)", def: 30, min: 0, max: 10000 },
] as const satisfies readonly IntSetting[];

export type IntSettingKey = (typeof INT_SETTINGS)[number]["key"];
const byKey = new Map<string, IntSetting>(INT_SETTINGS.map((s) => [s.key, s]));

export async function getInt(db: Tx, key: IntSettingKey): Promise<number> {
  const def = byKey.get(key)!;
  const row = await db.setting.findUnique({ where: { key } });
  const n = row ? Number.parseInt(row.value, 10) : Number.NaN;
  return Number.isFinite(n) && n >= def.min && n <= def.max ? n : def.def;
}

export async function getInts<K extends IntSettingKey>(db: Tx, keys: readonly K[]): Promise<Record<K, number>> {
  const rows = await db.setting.findMany({ where: { key: { in: [...keys] } } });
  const out = {} as Record<K, number>;
  for (const k of keys) {
    const def = byKey.get(k)!;
    const n = Number.parseInt(rows.find((r) => r.key === k)?.value ?? "", 10);
    out[k] = Number.isFinite(n) && n >= def.min && n <= def.max ? n : def.def;
  }
  return out;
}

export const settingsInGroup = (group: string) => INT_SETTINGS.filter((s) => s.group === group) as readonly IntSetting[];

/** Valida e grava os valores de um grupo vindos de um formulário. Devolve o que mudou. */
export async function saveIntGroup(db: Tx, group: string, values: Record<string, unknown>) {
  const changed: Record<string, number> = {};
  for (const s of settingsInGroup(group)) {
    const raw = values[s.key];
    if (raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < s.min || n > s.max) throw new Error(`${s.label}: valor entre ${s.min} e ${s.max}.`);
    await db.setting.upsert({ where: { key: s.key }, create: { key: s.key, value: String(n) }, update: { value: String(n) } });
    changed[s.key] = n;
  }
  return changed;
}
