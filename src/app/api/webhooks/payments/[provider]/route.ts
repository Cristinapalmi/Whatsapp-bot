import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProvider } from "@/domain/payments";
import { confirmPayment } from "@/domain/payments/service";

/**
 * WEBHOOK DOS PRESTADORES DE PAGAMENTO (Fase 3 — ainda inativo).
 *
 * O prestador chama este endereço quando um pagamento é concluído:
 *   https://<o-teu-dominio>/api/webhooks/payments/<prestador>
 *
 * Fluxo:
 *  1. O adaptador do prestador valida a assinatura (parseWebhook). Sem assinatura válida → 401.
 *  2. Encontra o PaymentRequest pela referência.
 *  3. Chama confirmPayment() — a MESMA função que o botão "Confirmar" do admin usa
 *     (desbloqueia, credita o artista, notifica). É idempotente: repetir o webhook não credita duas vezes.
 *
 * Enquanto os adaptadores não estiverem implementados, devolve 501.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  let provider;
  try {
    provider = getProvider(providerId);
  } catch {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  if (!provider.automatic || !provider.parseWebhook) return NextResponse.json({ error: "not supported" }, { status: 400 });

  const rawBody = await req.text();
  let event;
  try {
    event = await provider.parseWebhook({ headers: req.headers, rawBody });
  } catch (e) {
    console.error("webhook", providerId, e);
    return NextResponse.json({ error: "not configured or invalid signature" }, { status: 501 });
  }

  const payment = await db.paymentRequest.findFirst({
    where: { provider: providerId, OR: [{ providerRef: event.providerRef }, ...(event.paymentRequestId ? [{ id: event.paymentRequestId }] : [])] },
  });
  if (!payment) return NextResponse.json({ error: "payment not found" }, { status: 404 });
  if (event.status === "paid" && payment.status === "PENDING") {
    if (event.amountCents !== payment.amountCents) return NextResponse.json({ error: "amount mismatch" }, { status: 409 });
    await confirmPayment(db, { paymentId: payment.id, adminId: null, feeCents: event.feeCents });
  }
  // "refunded" → usar reversePayment() quando o prestador suportar reembolsos.
  return NextResponse.json({ ok: true });
}
