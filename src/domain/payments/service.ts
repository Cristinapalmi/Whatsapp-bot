import type { PaymentMethod, PrismaClient, Prisma as P } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { business } from "@config/business";
import { splitRevenue } from "../money/split";
import { PLATFORM_CASH, PLATFORM_REVENUE, artistAvailable, passPool, type AccountSpec } from "../money/accounts";
import { postEntry } from "../money/ledger";
import { weekKey } from "../money/weeks";
import { notify, audit } from "../notify";
import { welcomeOffer } from "../coins/welcome";
import { UserFacingError } from "../errors";
import { formatKz, kzToCents } from "@/lib/money";
import { creditCoinLot, reverseCoinPurchase } from "../coins/service";

/**
 * SERVIÇO DE PAGAMENTOS — regras centrais.
 * Usado pelo painel admin (fase manual) e, mais tarde, pelos webhooks dos prestadores.
 *
 * Tipos de compra:
 *  - EPISODE      → 50% para o artista da série (saldo disponível), 50% plataforma.
 *  - GIFT         → presente a um artista: 50% artista, 50% plataforma.
 *  - WEEKLY_PASS  → 50% plataforma; 50% vai para o FUNDO DO PASSE da semana,
 *                   dividido pelos artistas no fecho semanal (tempo de visualização).
 */

/** Normaliza o n.º da operação para comparar duplicados (sem espaços, maiúsculas). */
export const normalizeTransactionRef = (ref: string) => ref.replace(/[\s\-_.]/g, "").toUpperCase();

type ProofInput = {
  userId: string;
  method: PaymentMethod;
  payerPhone: string;
  transactionRef: string;
  proofHash: string;
  /** Guarda o ficheiro do comprovativo e devolve a chave. Só é chamado se tudo estiver válido. */
  storeProof: () => Promise<string>;
};

export type CreateEpisodePaymentInput = ProofInput & { episodeId: string };
export type CreateGiftPaymentInput = ProofInput & { artistId: string; giftId: string };
export type CreatePassPaymentInput = ProofInput;
export type CreateCoinPaymentInput = ProofInput & { packId: string };

/** Verificações comuns: limite de pendentes e comprovativo repetido. */
async function checkProof(db: PrismaClient, input: ProofInput) {
  const ref = normalizeTransactionRef(input.transactionRef);
  if (ref.length < 4) throw new UserFacingError("Indica o número da operação que aparece no comprovativo.");
  const pending = await db.paymentRequest.findMany({ where: { userId: input.userId, status: "PENDING" } });
  const dup = await db.paymentRequest.findFirst({
    where: { OR: [{ proofHash: input.proofHash }, { transactionRef: ref }] },
  });
  if (dup) throw new UserFacingError("Este comprovativo já foi usado noutro pedido.", "DUPLICATE_PROOF");
  return { ref, pending };
}

function checkPendingLimit(pending: { id: string }[]) {
  if (pending.length >= business.maxPendingPaymentsPerUser)
    throw new UserFacingError(
      `Tens ${pending.length} pedidos a aguardar confirmação. Espera que sejam confirmados antes de enviar mais.`,
    );
}

async function createRequest(
  db: PrismaClient,
  input: ProofInput,
  ref: string,
  data: Omit<P.PaymentRequestUncheckedCreateInput, "userId" | "method" | "payerPhone" | "transactionRef" | "proofHash" | "proofKey" | "provider">,
) {
  const proofKey = await input.storeProof();
  try {
    return await db.paymentRequest.create({
      data: {
        ...data,
        userId: input.userId,
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

export async function createEpisodePaymentRequest(db: PrismaClient, input: CreateEpisodePaymentInput) {
  const episode = await db.episode.findUnique({ where: { id: input.episodeId }, include: { series: true } });
  if (!episode || !episode.published || episode.series.status !== "PUBLISHED")
    throw new UserFacingError("Episódio não encontrado.");
  if (episode.number <= episode.series.freeEpisodes) throw new UserFacingError("Este episódio é grátis.");

  const already = await db.entitlement.findUnique({
    where: { userId_episodeId: { userId: input.userId, episodeId: episode.id } },
  });
  if (already) throw new UserFacingError("Já desbloqueaste este episódio.");

  if (normalizeTransactionRef(input.transactionRef).length < 4)
    throw new UserFacingError("Indica o número da operação que aparece no comprovativo.");
  const pendingNow = await db.paymentRequest.findMany({ where: { userId: input.userId, status: "PENDING" } });
  if (pendingNow.some((p) => p.episodeId === episode.id))
    throw new UserFacingError("Já tens um pedido para este episódio a aguardar confirmação.");
  checkPendingLimit(pendingNow);
  const { ref } = await checkProof(db, input);

  return createRequest(db, input, ref, {
    kind: "EPISODE",
    episodeId: episode.id,
    artistId: episode.series.artistId,
    amountCents: episode.series.priceCents,
  });
}

export async function createPassPaymentRequest(db: PrismaClient, input: CreatePassPaymentInput) {
  const { ref, pending } = await checkProof(db, input);
  if (pending.some((p) => p.kind === "WEEKLY_PASS"))
    throw new UserFacingError("Já tens um pedido de passe a aguardar confirmação.");
  checkPendingLimit(pending);
  return createRequest(db, input, ref, { kind: "WEEKLY_PASS", amountCents: kzToCents(business.weeklyPassPriceKz) });
}

/** Pedido de compra de um pacote de moedas (as moedas só entram depois de o admin confirmar). */
export async function createCoinPaymentRequest(db: PrismaClient, input: CreateCoinPaymentInput) {
  const pack = await db.coinPack.findUnique({ where: { id: input.packId } });
  if (!pack || !pack.active) throw new UserFacingError("Este pacote de moedas não está disponível.");
  const { ref, pending } = await checkProof(db, input);
  checkPendingLimit(pending);
  // Oferta de boas-vindas: verificada AQUI no servidor (nunca confiamos no que vem do telemóvel)
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, welcomeOfferStartedAt: true } });
  const offer = await welcomeOffer(db, user);
  const bonusCoins = offer && offer.expiresAt && offer.packId === pack.id ? offer.bonusCoins : 0;
  return createRequest(db, input, ref, {
    kind: "COINS",
    coinPackId: pack.id,
    coins: pack.coins + bonusCoins,
    bonusCoins,
    amountCents: kzToCents(pack.priceKz),
  });
}

export function findGift(giftId: string) {
  const gift = business.gifts.find((g) => g.id === giftId);
  if (!gift) throw new UserFacingError("Presente inválido.");
  return gift;
}

export async function createGiftPaymentRequest(db: PrismaClient, input: CreateGiftPaymentInput) {
  const gift = findGift(input.giftId);
  const artist = await db.artistProfile.findUnique({ where: { id: input.artistId } });
  if (!artist || artist.status !== "APPROVED") throw new UserFacingError("Artista não encontrado.");
  if (artist.userId === input.userId) throw new UserFacingError("Não podes oferecer presentes a ti próprio.");
  const { ref, pending } = await checkProof(db, input);
  checkPendingLimit(pending);
  return createRequest(db, input, ref, {
    kind: "GIFT",
    artistId: artist.id,
    giftType: gift.id,
    amountCents: kzToCents(gift.priceKz),
  });
}

/**
 * CONFIRMAR um pagamento: desbloqueia/ativa, regista o dinheiro no livro-razão
 * e notifica. Tudo numa única transação: ou acontece tudo, ou nada.
 * Na fase manual a parte do artista vai para o saldo DISPONÍVEL (o dinheiro já está na conta da plataforma).
 */
export async function confirmPayment(
  db: PrismaClient,
  { paymentId, adminId, feeCents, now = new Date() }: { paymentId: string; adminId: string | null; feeCents?: number; now?: Date },
) {
  return db.$transaction(async (tx) => {
    // Muda o estado só se ainda estiver PENDENTE — impede confirmar duas vezes.
    const updated = await tx.paymentRequest.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: {
        status: "CONFIRMED",
        reviewedById: adminId,
        reviewedAt: now,
        ...(feeCents !== undefined ? { feeCents } : {}),
      },
    });
    if (updated.count !== 1) throw new UserFacingError("Este pedido já não está a aguardar confirmação.");

    const p = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentId },
      include: { episode: { include: { series: true } }, artist: true },
    });

    // Compra de moedas: o dinheiro fica em "Moedas por gastar" (ainda não é receita de ninguém).
    if (p.kind === "COINS") {
      if (!p.coins || p.coins <= 0) throw new Error("Compra de moedas sem quantidade");
      const netCents = p.amountCents - p.feeCents;
      if (netCents < 0) throw new UserFacingError("A comissão não pode ser maior que o valor pago.");
      await creditCoinLot(tx, { id: p.id, userId: p.userId, coins: p.coins, netCents, adminId });
      await audit(tx, adminId, "PAYMENT_CONFIRMED", "PaymentRequest", p.id, { kind: "COINS", coins: p.coins, netCents });
      return { payment: p, artistCents: 0, platformCents: 0 };
    }

    const { netCents, artistCents, platformCents } = splitRevenue(p.amountCents, p.feeCents, business.artistSharePercent);

    let shareAccount: AccountSpec;
    let description: string;
    if (p.kind === "EPISODE") {
      if (!p.episode || !p.artistId) throw new Error("Pagamento de episódio sem episódio/artista");
      shareAccount = artistAvailable(p.artistId);
      description = `Episódio ${p.episode.number} de "${p.episode.series.title}"`;
    } else if (p.kind === "GIFT") {
      if (!p.artistId) throw new Error("Presente sem artista");
      shareAccount = artistAvailable(p.artistId);
      description = `Presente ${findGift(p.giftType ?? "").label} para ${p.artist?.stageName ?? "artista"}`;
    } else {
      const week = weekKey(now);
      shareAccount = passPool(week);
      description = `Passe semanal (fundo ${week})`;
    }

    await postEntry(tx, {
      kind: "PAYMENT_CONFIRMED",
      description,
      idempotencyKey: `payment:${p.id}:confirm`,
      paymentRequestId: p.id,
      createdById: adminId ?? undefined,
      lines: [
        { account: PLATFORM_CASH, amountCents: netCents },
        { account: PLATFORM_REVENUE, amountCents: -platformCents },
        { account: shareAccount, amountCents: -artistCents },
      ],
    });

    if (p.kind === "EPISODE" && p.episode) {
      const existing = await tx.entitlement.findUnique({
        where: { userId_episodeId: { userId: p.userId, episodeId: p.episode.id } },
      });
      if (!existing) {
        await tx.entitlement.create({
          data: { userId: p.userId, episodeId: p.episode.id, source: "PAYMENT", paymentRequestId: p.id },
        });
      }
      await notify(tx, p.userId, "Pagamento confirmado", `O episódio ${p.episode.number} de "${p.episode.series.title}" está desbloqueado. Bom filme!`, `/ver/${p.episode.id}`);
    } else if (p.kind === "GIFT") {
      await notify(tx, p.userId, "Presente entregue", `${p.artist?.stageName} recebeu o teu presente. Obrigado pelo apoio!`, "/conta");
    } else {
      // Passe: começa agora, ou no fim do passe que ainda estiver ativo (prolonga).
      const active = await tx.weeklyPass.findFirst({
        where: { userId: p.userId, revokedAt: null, endsAt: { gt: now } },
        orderBy: { endsAt: "desc" },
      });
      const startsAt = active ? active.endsAt : now;
      const endsAt = new Date(startsAt.getTime() + business.weeklyPassDays * 86400000);
      await tx.weeklyPass.create({ data: { userId: p.userId, startsAt, endsAt, paymentRequestId: p.id } });
      await notify(tx, p.userId, "Passe semanal ativo", `Podes ver todos os episódios até ${endsAt.toLocaleDateString("pt-AO", { timeZone: "Africa/Luanda" })}.`, "/");
    }

    if (p.artistId && p.artist) {
      await notify(tx, p.artist.userId, p.kind === "GIFT" ? "Recebeste um presente" : "Ganhaste dinheiro", `+${formatKz(artistCents)} na tua carteira.`, "/artista/carteira");
    }
    await audit(tx, adminId, "PAYMENT_CONFIRMED", "PaymentRequest", p.id, { kind: p.kind, artistCents, platformCents });
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
 * ANULAR um pagamento já confirmado (ex.: transferência falsa, reembolso).
 * Faz o lançamento inverso e retira o acesso (episódio ou passe).
 * - A carteira do artista pode ficar negativa; os levantamentos ficam bloqueados até compensar.
 * - Passe cuja semana JÁ FOI FECHADA: a parte dos artistas sai do fundo da semana ATUAL
 *   (reduz a próxima distribuição), para a plataforma nunca pagar do próprio bolso.
 */
export async function reversePayment(
  db: PrismaClient,
  { paymentId, adminId, reason, now = new Date() }: { paymentId: string; adminId: string; reason: string; now?: Date },
) {
  const r = reason.trim();
  if (r.length < 3) throw new UserFacingError("Indica o motivo da anulação.");
  return db.$transaction(async (tx) => {
    const updated = await tx.paymentRequest.updateMany({
      where: { id: paymentId, status: "CONFIRMED" },
      data: { status: "REVERSED", rejectionReason: r, reviewedById: adminId, reviewedAt: now },
    });
    if (updated.count !== 1) throw new UserFacingError("Só é possível anular pagamentos confirmados.");

    const payment = await tx.paymentRequest.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.kind === "COINS") {
      // Anula primeiro os gastos feitos com estas moedas (episódios voltam a bloquear,
      // o artista perde a parte correspondente) e retira as moedas da carteira.
      await reverseCoinPurchase(tx, paymentId, adminId, r);
    }

    const original = await tx.journalEntry.findUniqueOrThrow({
      where: { idempotencyKey: `payment:${paymentId}:confirm` },
      include: { lines: { include: { account: true } } },
    });
    const lines: { account: AccountSpec; amountCents: number }[] = [];
    for (const l of original.lines) {
      let account: AccountSpec = { code: l.account.code, name: l.account.name, type: l.account.type, artistId: l.account.artistId ?? undefined };
      if (l.account.code.startsWith("pass-pool:")) {
        const week = l.account.code.slice("pass-pool:".length);
        const closed = await tx.journalEntry.findUnique({ where: { idempotencyKey: `pass-close:${week}` } });
        if (closed) account = passPool(weekKey(now));
      }
      lines.push({ account, amountCents: -l.amountCents });
    }
    await postEntry(tx, {
      kind: "PAYMENT_REVERSED",
      description: `Anulação: ${original.description} — ${r}`,
      idempotencyKey: `payment:${paymentId}:reverse`,
      paymentRequestId: paymentId,
      createdById: adminId,
      lines,
    });
    await tx.entitlement.deleteMany({ where: { paymentRequestId: paymentId } });
    await tx.weeklyPass.updateMany({ where: { paymentRequestId: paymentId }, data: { revokedAt: now } });
    const p = await tx.paymentRequest.findUniqueOrThrow({ where: { id: paymentId } });
    await notify(tx, p.userId, "Pagamento anulado", `Motivo: ${r}`, "/conta");
    await audit(tx, adminId, "PAYMENT_REVERSED", "PaymentRequest", p.id, { reason: r });
    return p;
  });
}
