/**
 * SEMANAS DO PASSE (hora de Luanda, UTC+1, sem hora de verão).
 * A semana vai de segunda 00:00 a domingo 23:59 (hora de Luanda).
 * Identificador: "2026-W47" (semana ISO).
 */
const LUANDA_OFFSET_MS = 60 * 60 * 1000;

export function weekKey(d: Date): string {
  const local = new Date(d.getTime() + LUANDA_OFFSET_MS);
  const day = local.getUTCDay() || 7; // 1=segunda … 7=domingo
  const thursday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 4 - day));
  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((thursday.getTime() - jan1) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Início (segunda 00:00 Luanda) e fim (segunda seguinte) de uma semana, em UTC. */
export function weekRange(key: string): { start: Date; end: Date } {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) throw new Error(`Semana inválida: ${key}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = Date.UTC(year, 0, 4 - jan4Day + 1);
  const startLocal = mondayWeek1 + (week - 1) * 7 * 86400000;
  return {
    start: new Date(startLocal - LUANDA_OFFSET_MS),
    end: new Date(startLocal + 7 * 86400000 - LUANDA_OFFSET_MS),
  };
}

export const nextWeekKey = (key: string) => weekKey(weekRange(key).end);
export const previousWeekKey = (key: string) => weekKey(new Date(weekRange(key).start.getTime() - 1));

/** Dias (datas UTC à meia-noite) abrangidos por uma semana — para filtrar os registos diários de visualização. */
export function weekDays(key: string): { from: Date; to: Date } {
  const { start } = weekRange(key);
  const local = new Date(start.getTime() + LUANDA_OFFSET_MS);
  const from = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  return { from, to: new Date(from.getTime() + 7 * 86400000) };
}
