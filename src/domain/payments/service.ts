import type { PaymentMethod, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { business } from "@config/business";
import { splitRevenue } from "../money/split";
import { PLATFORM_CASH, PLATFORM_REVENUE, artistAvailable } from "../money/accounts";
import { postEntry } from "../money/ledger";
import { notify, audit } from "../notify";
import { UserFacingError } from "../errors";
import { formatKz } from "@/lib/money";

/**
 * SERVIÇO DE PAGAMENTOS — regras centrais.
 * Usado pelo painel admin (fase manual) e, mais tarde, pelos webhooks dos prestadores.
 */

/** Normaliza o n.º da operação para comparar duplicados (sem espaços, maiúsculas). */
export const normalizeTransactionRef = (ref: string) => ref.replace(/[\s\-_.]/g, "").toUpperCase();

export type CreateEpisodePaymentInput = {
  userId: string;
  episodeId: string;
  method: PaymentMethod;
  payerPhone: string;
  transactionRef: string;
  proofHash: string;
  /** Guarda o ficheiro do comprovativo e devolve a chave de armazenamento. Só é chamado se tudo estiver válido. */
  storeProof: () => Promise<string>;
};

export async function createEpisodePaymentRequest(db: PrismaClient, input: CreateEpisodePaymentInput) {
  const ref = normalizeTransactionRef(input.transactionRef);
  if (ref.length < 4) throw new UserFacingError("Indica o número da operação que aparece no comprovativo.");

  const episode = await db.episode.findUnique({ where: { id: input.episodeId }, include: { series: true } });
  if (!episode || !episode.published || episode.series.status !== "PUBLISHED")
    throw new UserFacingError("Episódio não encontrado.");
  if (episode.number <= episode.series.freeEpisodes) throw new UserFacingError("Este episódio é grátis.");

  const already = await db.entitlement.findUnique({
    where: { userId_episodeId: { userId: input.userId, episodeId: episode.id } },
  });
  if (already) throw new UserFacingError("Já desbloqueaste este episódio.");

  const pending = await db.paymentRequest.findMany({ where: { userId: input.userId, status: "PENDING" } });
  if (pending.some((p) => p.episodeId === episode.id))
    throw new UserFacingError("Já tens um pedido para este episódio a aguardar confirmação.");
  if (pending.length >= business.maxPendingPaymentsPerUser)
    throw new UserFacingError(
      `Tens ${pending.length} pedidos a aguardar confirmação. Espera que sejam confirmados antes de enviar mais.`,
    );

  const dup = await db.paymentRequest.findFirst({
    where: { OR: [{ proofHash: input.proofHash }, { transactionRef: ref }] },
  });
  if (dup) throw new UserFacingError("Este comprovativo já foi usado noutro pedido.", "DUPLICATE_PROOF");

  const proofKey = await input.storeProof();
  try {
    return await db.paymentRequest.create({
      data: {
        userId: input.userId,
        kind: "EPISODE",
        episodeId: episode.id,
        artistId: episode.series.artistId,
        amountCents: episode.series.priceCents,
        method: input.method,
        provider: "manual",
        payerPhone: input.payerPhone,
        transactionRef: ref,
        proofKey,
        proofHash: input.proofHash,
      },
    });
  } catch (e) {
    // Proteção contra dois envios simultâneos do mesmo comprovativo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new UserFacingError("Este comprovativo já foi usado noutro pedido.", "DUPLICATE_PROOF");
    throw e;
  }
}

/**
 * CONFIRMAR um pagamento: desbloqueia, credita 50% ao artista (saldo DISPONÍVEL,
 * porque na fase manual o dinheiro já está na conta da plataforma) e notifica o fã.
 * Tudo numa única transação: ou acontece tudo, ou nada.
 */
export async function confirmPayment(
  db: PrismaClient,
  { paymentId, adminId, feeCents }: { paymentId: string; adminId: string | null; feeCents?: number },
) {
  return db.$transaction(async (tx) => {
    // Muda o estado só se ainda estiver PENDENTE — impede confirmar duas vezes.
    const updated = await tx.paymentRequest.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        ...(feeCents !== undefined ? { feeCents } : {}),
      },
    });
    if (updated.count !== 1) throw new UserFacingError("Este pedido já não está a aguardar confirmação.");

    const p = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentId },
      include: { episode: { include: { series: true } } },
    });

    if (p.kind !== "EPISODE" || !p.episode || !p.artistId)
      throw new UserFacingError("Tipo de pagamento ainda não suportado nesta fase.");

    const { netCents, artistCents, platformCents } = splitRevenue(
      p.amountCents,
      p.feeCents,
      business.artistSharePercent,
    );

    await postEntry(tx, {
      kind: "PAYMENT_CONFIRMED",
      description: `Episódio ${p.episode.number} de "${p.episode.series.title}"`,
      idempotencyKey: `payment:${p.id}:confirm`,
      paymentRequestId: p.id,
      createdById: adminId ?? undefined,
      lines: [
        { account: PLATFORM_CASH, amountCents: netCents },
        { account: PLATFORM_REVENUE, amountCents: -platformCents },
        { account: artistAvailable(p.artistId), amountCents: -artistCents },
      ],
    });

    const existing = await tx.entitlement.findUnique({
      where: { userId_episodeId: { userId: p.userId, episodeId: p.episode.id } },
    });
    if (!existing) {
      await tx.entitlement.create({
        data: { userId: p.userId, episodeId: p.episode.id, source: "PAYMENT", paymentRequestId: p.id },
      });
    }

    await notify(
      tx,
      p.userId,
      "Pagamento confirmado",
      `O episódio ${p.episode.number} de "${p.episode.series.title}" está desbloqueado. Bom filme!`,
      `/ver/${p.episode.id}`,
    );
    const artist = await tx.artistProfile.findUnique({ where: { id: p.artistId } });
    if (artist) {
      await notify(tx, artist.userId, "Ganhaste dinheiro", `+${formatKz(artistCents)} na tua carteira.`, "/artista/carteira");
    }
    await audit(tx, adminId, "PAYMENT_CONFIRMED", "PaymentRequest", p.id, { artistCents, platformCents });
    return { payment: p, artistCents, platformCents };
  });
}

/** REJEITAR um pedido pendente (comprovativo inválido, valor errado, etc.). Não mexe em dinheiro. */
export async function rejectPayment(
  db: PrismaClient,
  { paymentId, adminId, reason }: { paymentId: string; adminId: string; reason: string },
) {
  const r = reason.trim();
  if (r.length < 3) throw new UserFacingError("Indica o motivo da rejeição.");
  return db.$transaction(async (tx) => {
    const updated = await tx.paymentRequest.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "REJECTED", rejectionReason: r, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (updated.count !== 1) throw new UserFacingError("Este pedido já não está a aguardar confirmação.");
    const p = await tx.paymentRequest.findUniqueOrThrow({ where: { id: paymentId } });
    await notify(tx, p.userId, "Pagamento não confirmado", `Motivo: ${r}`, "/conta");
    await audit(tx, adminId, "PAYMENT_REJECTED", "PaymentRequest", p.id, { reason: r });
    return p;
  });
}

/**
 * ANULAR um pagamento já confirmado (ex.: descobriu-se que a transferência era falsa).
 * Faz o lançamento inverso exato e retira o acesso ao episódio.
 * A carteira do artista pode ficar negativa; nesse caso os levantamentos ficam
 * bloqueados até ganhos futuros compensarem.
 */
export async function reversePayment(
  db: PrismaClient,
  { paymentId, adminId, reason }: { paymentId: string; adminId: string; reason: string },
) {
  const r = reason.trim();
  if (r.length < 3) throw new UserFacingError("Indica o motivo da anulação.");
  return db.$transaction(async (tx) => {
    const updated = await tx.paymentRequest.updateMany({
      where: { id: paymentId, status: "CONFIRMED" },
      data: { status: "REVERSED", rejectionReason: r, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (updated.count !== 1) throw new UserFacingError("Só é possível anular pagamentos confirmados.");

    const original = await tx.journalEntry.findUniqueOrThrow({
      where: { idempotencyKey: `payment:${paymentId}:confirm` },
      include: { lines: { include: { account: true } } },
    });
    await postEntry(tx, {
      kind: "PAYMENT_REVERSED",
      description: `Anulação: ${original.description} — ${r}`,
      idempotencyKey: `payment:${paymentId}:reverse`,
      paymentRequestId: paymentId,
      createdById: adminId,
      lines: original.lines.map((l) => ({
        account: {
          code: l.account.code,
          name: l.account.name,
          type: l.account.type,
          artistId: l.account.artistId ?? undefined,
        },
        amountCents: -l.amountCents,
      })),
    });
    await tx.entitlement.deleteMany({ where: { paymentRequestId: paymentId } });
    const p = await tx.paymentRequest.findUniqueOrThrow({ where: { id: paymentId } });
    await notify(tx, p.userId, "Pagamento anulado", `Motivo: ${r}`, "/conta");
    await audit(tx, adminId, "PAYMENT_REVERSED", "PaymentRequest", p.id, { reason: r });
    return p;
  });
}
