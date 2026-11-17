/**
 * REGRAS PURAS DE DIVISÃO DE DINHEIRO (sem base de dados — fáceis de testar).
 * Todos os valores em cêntimos (inteiros).
 */

export class MoneyError extends Error {}

function assertCents(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0) throw new MoneyError(`${label} tem de ser um inteiro ≥ 0 (cêntimos)`);
}

/**
 * Divide o que o público pagou entre artista e plataforma.
 * A comissão do prestador (se existir) é tirada ANTES da divisão.
 * O artista recebe a percentagem arredondada para baixo ao cêntimo;
 * o resto (incluindo meio cêntimo de arredondamento) fica para a plataforma.
 */
export function splitRevenue(amountCents: number, feeCents: number, artistPercent: number) {
  assertCents(amountCents, "Valor");
  assertCents(feeCents, "Comissão");
  if (feeCents > amountCents) throw new MoneyError("A comissão não pode ser maior que o valor pago");
  if (!Number.isInteger(artistPercent) || artistPercent < 0 || artistPercent > 100)
    throw new MoneyError("Percentagem do artista inválida");
  const netCents = amountCents - feeCents;
  const artistCents = Math.floor((netCents * artistPercent) / 100);
  const platformCents = netCents - artistCents;
  return { netCents, artistCents, platformCents };
}

/**
 * Divide o fundo do passe semanal pelos artistas, proporcionalmente aos segundos vistos.
 * - Cada artista recebe floor(fundo × segundos / total).
 * - Os cêntimos que sobram do arredondamento vão para a plataforma (`remainderCents`).
 * - Se ninguém viu nada, nada é distribuído e o fundo passa para a semana seguinte (`rolloverCents`).
 */
export function distributePassPool(poolCents: number, secondsByArtist: Record<string, number>) {
  assertCents(poolCents, "Fundo");
  const entries = Object.entries(secondsByArtist).filter(([, s]) => {
    if (!Number.isFinite(s) || s < 0) throw new MoneyError("Segundos inválidos");
    return s > 0;
  });
  const totalSeconds = entries.reduce((acc, [, s]) => acc + s, 0);
  if (poolCents === 0 || totalSeconds === 0) {
    return { allocations: {} as Record<string, number>, remainderCents: 0, rolloverCents: poolCents };
  }
  const allocations: Record<string, number> = {};
  let distributed = 0;
  for (const [artistId, seconds] of entries) {
    const cents = Math.floor((poolCents * seconds) / totalSeconds);
    if (cents > 0) allocations[artistId] = cents;
    distributed += cents;
  }
  return { allocations, remainderCents: poolCents - distributed, rolloverCents: 0 };
}
