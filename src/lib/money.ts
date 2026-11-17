/** Conversões de dinheiro. Internamente tudo é em cêntimos (inteiros). */

export const kzToCents = (kz: number): number => {
  if (!Number.isFinite(kz)) throw new Error("Valor inválido");
  return Math.round(kz * 100);
};

export const centsToKz = (cents: number): number => cents / 100;

/** Formata para mostrar ao utilizador, ex.: 12500 → "125 Kz", 3750 → "37,50 Kz". */
export const formatKz = (cents: number): string => {
  const kz = cents / 100;
  const hasDecimals = Math.round(cents) % 100 !== 0;
  return (
    new Intl.NumberFormat("pt-AO", {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(kz) + " Kz"
  );
};
