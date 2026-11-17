/**
 * Normaliza números de telemóvel angolanos para o formato +2449XXXXXXXX.
 * Aceita "923 456 789", "+244923456789", "00244923456789", "244923456789".
 * Devolve null se não for um número angolano válido.
 */
export function normalizeAngolanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let local = digits;
  if (local.startsWith("00244")) local = local.slice(5);
  else if (local.startsWith("244") && local.length === 12) local = local.slice(3);
  if (!/^9\d{8}$/.test(local)) return null;
  return `+244${local}`;
}

export const formatPhone = (p: string) =>
  p.startsWith("+244") ? `+244 ${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}` : p;
