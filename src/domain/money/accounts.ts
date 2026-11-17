import type { AccountType } from "@prisma/client";

/**
 * Plano de contas do livro-razão.
 *
 *  platform:cash               ATIVO      Dinheiro que entrou nas contas da plataforma
 *  platform:revenue            RECEITA    Os 50% da plataforma (+ restos de arredondamento)
 *  artist:<id>:available       PASSIVO    Carteira do artista — saldo DISPONÍVEL
 *  artist:<id>:pending         PASSIVO    Carteira do artista — saldo PENDENTE (fase automática)
 *  artist:<id>:payout          PASSIVO    Levantamentos "em processamento" (dinheiro reservado)
 *  pass-pool:<semana>          PASSIVO    Parte dos artistas do passe semanal, à espera do fecho
 */

export type AccountSpec = { code: string; name: string; type: AccountType; artistId?: string };

export const PLATFORM_CASH: AccountSpec = { code: "platform:cash", name: "Caixa da plataforma", type: "ASSET" };
export const PLATFORM_REVENUE: AccountSpec = { code: "platform:revenue", name: "Receita da plataforma", type: "REVENUE" };

export const artistAvailable = (artistId: string): AccountSpec => ({
  code: `artist:${artistId}:available`,
  name: "Carteira do artista (disponível)",
  type: "LIABILITY",
  artistId,
});
export const artistPending = (artistId: string): AccountSpec => ({
  code: `artist:${artistId}:pending`,
  name: "Carteira do artista (pendente)",
  type: "LIABILITY",
  artistId,
});
export const artistPayout = (artistId: string): AccountSpec => ({
  code: `artist:${artistId}:payout`,
  name: "Levantamentos em processamento",
  type: "LIABILITY",
  artistId,
});
export const passPool = (weekKey: string): AccountSpec => ({
  code: `pass-pool:${weekKey}`,
  name: `Fundo do passe semanal ${weekKey}`,
  type: "LIABILITY",
});

/** Tipos de lançamento que contam como "ganho" do artista. */
export const EARNING_KINDS = ["PAYMENT_CONFIRMED", "PAYMENT_REVERSED", "PASS_DISTRIBUTION"] as const;
