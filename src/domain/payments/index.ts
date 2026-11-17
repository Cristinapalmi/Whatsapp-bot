import type { PaymentProvider } from "./provider";
import { manualProvider } from "./providers/manual";
import { multicaixaExpressProvider } from "./providers/multicaixa-express";
import { paypayProvider } from "./providers/paypay";
import { referenceProvider } from "./providers/reference";

/** Registo de prestadores. Na Fase 1 só o "manual" está ativo. */
export const providers: Record<string, PaymentProvider> = {
  manual: manualProvider,
  "multicaixa-express": multicaixaExpressProvider,
  paypay: paypayProvider,
  reference: referenceProvider,
};

/** Prestadores mostrados ao público. Acrescentar aqui quando um adaptador estiver pronto. */
export const ACTIVE_PROVIDERS = ["manual"] as const;

export function getProvider(id: string): PaymentProvider {
  const p = providers[id];
  if (!p) throw new Error(`Prestador desconhecido: ${id}`);
  return p;
}
