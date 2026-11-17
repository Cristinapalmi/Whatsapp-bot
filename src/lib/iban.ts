/**
 * Valida um IBAN angolano: "AO06" seguido de 21 dígitos (25 caracteres no total),
 * incluindo o dígito de controlo internacional (ISO 13616, módulo 97).
 */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidAngolanIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^AO06\d{21}$/.test(iban)) return false;
  // Módulo 97: move os 4 primeiros caracteres para o fim e converte letras em números.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}

export const formatIban = (iban: string) => normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
