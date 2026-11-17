import type { PaymentMethod } from "@prisma/client";

/**
 * CAMADA "PaymentProvider" — uma interface comum para todas as formas de pagamento.
 *
 * Fase 1: só existe o prestador "manual" (o fã transfere e envia o comprovativo; a
 * administração confirma à mão).
 *
 * Fase 3: quando houver contrato com um prestador angolano autorizado, implementa-se
 * o adaptador correspondente (multicaixa-express.ts, paypay.ts, reference.ts). O resto
 * da app NÃO muda: a confirmação automática chama exatamente a mesma função
 * `confirmPayment()` que o botão "Confirmar" do admin usa hoje.
 */

export type InitiateInput = {
  paymentRequestId: string;
  amountCents: number;
  description: string;
  payerPhone?: string;
};

export type InitiateResult =
  /** Mostrar instruções ao fã (fase manual, ou referência para pagar no ATM/app do banco). */
  | { type: "instructions"; lines: { label: string; value: string }[]; reference?: string; expiresAt?: Date }
  /** Pedido enviado para a app do banco do fã (ex.: notificação Multicaixa Express no telemóvel). */
  | { type: "push_sent"; providerRef: string }
  /** Redirecionar o fã para a página do prestador. */
  | { type: "redirect"; url: string; providerRef: string };

/** Evento normalizado recebido do prestador através de webhook. */
export type WebhookEvent = {
  providerRef: string;
  paymentRequestId?: string;
  status: "paid" | "failed" | "refunded";
  amountCents: number;
  /** Comissão cobrada pelo prestador (descontada antes da divisão 50/50). */
  feeCents: number;
};

export interface PaymentProvider {
  /** Identificador interno guardado em PaymentRequest.provider. */
  id: string;
  label: string;
  /** true = o prestador confirma sozinho (webhook); false = confirmação manual. */
  automatic: boolean;
  methods: PaymentMethod[];
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /**
   * Valida a assinatura do webhook e converte-o num WebhookEvent.
   * DEVE rejeitar pedidos sem assinatura válida (nunca confiar no corpo do pedido sem verificar).
   */
  parseWebhook?(req: { headers: Headers; rawBody: string }): Promise<WebhookEvent>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `O prestador "${provider}" ainda não está configurado. ` +
        `Ver docs/FASE-3.md e o ficheiro src/domain/payments/providers/${provider}.ts`,
    );
  }
}
