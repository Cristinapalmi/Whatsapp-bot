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
