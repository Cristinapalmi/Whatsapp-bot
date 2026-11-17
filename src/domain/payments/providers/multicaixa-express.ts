import type { PaymentProvider } from "../provider";
import { ProviderNotConfiguredError } from "../provider";

/**
 * ADAPTADOR "Multicaixa Express" — VAZIO (Fase 3).
 *
 * IMPORTANTE: este ficheiro NÃO contém nenhuma API real. As APIs de pagamento em
 * Angola são disponibilizadas por prestadores autorizados pelo BNA (ex.: através da
 * EMIS/rede Multicaixa ou de agregadores de pagamento). Cada prestador tem a sua
 * própria documentação, ambiente de testes e formato de webhook.
 *
 * Quando tiveres contrato com um prestador:
 *   1. Pede-lhe a documentação técnica, as credenciais de TESTE e o segredo do webhook.
 *   2. Guarda as credenciais APENAS em variáveis de ambiente (nunca no código), ex.:
 *        MULTICAIXA_EXPRESS_API_URL=...
 *        MULTICAIXA_EXPRESS_API_KEY=...
 *        MULTICAIXA_EXPRESS_WEBHOOK_SECRET=...
 *   3. Implementa `initiate()` com o pedido de cobrança indicado pelo prestador.
 *   4. Implementa `parseWebhook()`: validar a assinatura com MULTICAIXA_EXPRESS_WEBHOOK_SECRET,
 *      e converter o corpo num WebhookEvent (estado, valor, comissão, referência).
 *   5. O webhook já tem rota preparada: src/app/api/webhooks/payments/[provider]/route.ts
 *      que chama `confirmPayment()` — a mesma função usada hoje pelo admin.
 *   6. Na fase automática, o crédito ao artista pode ir para o saldo PENDENTE até o
 *      prestador liquidar o dinheiro (ver docs/FASE-3.md).
 */
export const multicaixaExpressProvider: PaymentProvider = {
  id: "multicaixa-express",
  label: "Multicaixa Express",
  automatic: true,
  methods: ["MULTICAIXA_EXPRESS"],
  async initiate() {
    throw new ProviderNotConfiguredError("multicaixa-express");
  },
  async parseWebhook() {
    throw new ProviderNotConfiguredError("multicaixa-express");
  },
};
