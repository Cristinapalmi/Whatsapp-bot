import type { PaymentStatus, PayoutStatus } from "@prisma/client";

const PAYMENT: Record<PaymentStatus, [string, string]> = {
  PENDING: ["A aguardar confirmação", "badge-pending"],
  CONFIRMED: ["Confirmado", "badge-free"],
  REJECTED: ["Rejeitado", "badge-danger"],
  REVERSED: ["Anulado", "badge-danger"],
};
const PAYOUT: Record<PayoutStatus, [string, string]> = {
  PROCESSING: ["Em processamento", "badge-pending"],
  PAID: ["Pago", "badge-free"],
  REJECTED: ["Rejeitado", "badge-danger"],
};

export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => <span className={PAYMENT[status][1]}>{PAYMENT[status][0]}</span>;
export const PayoutStatusBadge = ({ status }: { status: PayoutStatus }) => <span className={PAYOUT[status][1]}>{PAYOUT[status][0]}</span>;
