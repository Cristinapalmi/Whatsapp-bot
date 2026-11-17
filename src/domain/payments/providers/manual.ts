import { business } from "@config/business";
import { formatKz } from "@/lib/money";
import type { PaymentProvider } from "../provider";

/**
 * Prestador MANUAL (Fase 1).
 * O fã transfere por Multicaixa Express ou transferência bancária, carrega o
 * comprovativo, e a administração confirma no painel /admin/pagamentos.
 * Os dados (número, IBAN, titular) vêm de config/business.ts / variáveis de ambiente.
 */
export const manualProvider: PaymentProvider = {
  id: "manual",
  label: "Transferência com comprovativo",
  automatic: false,
  methods: ["MULTICAIXA_EXPRESS", "BANK_TRANSFER"],
  async initiate({ amountCents }) {
    const p = business.manualPayment;
    return {
      type: "instructions",
      lines: [
        { label: "Valor a transferir", value: formatKz(amountCents) },
        { label: "Multicaixa Express para o número", value: p.multicaixaExpressNumber },
        { label: "Ou transferência para o IBAN", value: p.iban },
        { label: "Titular", value: p.accountHolder },
        { label: "Banco", value: p.bankName },
      ],
    };
  },
};
