/** Idade completa numa data. */
export function ageOn(birthDate: Date, on: Date = new Date()): number {
  let age = on.getFullYear() - birthDate.getFullYear();
  const m = on.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < birthDate.getDate())) age--;
  return age;
}

/** Início do mês (UTC). */
export const startOfMonthUtc = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/** Dia (UTC, à meia-noite) — usado nos registos diários de visualização. */
export const dayUtc = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Luanda",
  }).format(d);

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(d);

/** Dia em Luanda (UTC+1), guardado como data à meia-noite — usado nos registos diários. */
export const dayLuanda = (d = new Date()) => dayUtc(new Date(d.getTime() + 60 * 60 * 1000));
