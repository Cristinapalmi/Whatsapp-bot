"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { phoneSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import { newKey, putObject, sha256 } from "@/domain/storage";
import {
  createEpisodePaymentRequest,
  createGiftPaymentRequest,
  createPassPaymentRequest,
} from "@/domain/payments/service";
import { redeemEpisodeWithPoints } from "@/domain/points";
import type { ActionResult } from "@/components/ActionForm";

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  kind: z.enum(["EPISODE", "WEEKLY_PASS", "GIFT"]),
  episodeId: z.string().optional(),
  artistId: z.string().optional(),
  giftId: z.string().optional(),
  method: z.enum(["MULTICAIXA_EXPRESS", "BANK_TRANSFER"], { errorMap: () => ({ message: "Escolhe como pagaste." }) }),
  payerPhone: phoneSchema,
  transactionRef: z.string().trim().min(4, "Indica o número da operação que aparece no comprovativo.").max(60),
});

export async function submitPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const g = (k: string) => (fd.get(k) === null ? undefined : String(fd.get(k)));
    const data = schema.parse({
      kind: g("kind"), episodeId: g("episodeId"), artistId: g("artistId"), giftId: g("giftId"),
      method: g("method"), payerPhone: g("payerPhone"), transactionRef: g("transactionRef"),
    });
    const file = fd.get("proof");
    if (!(file instanceof File) || file.size === 0) return { error: "Carrega a fotografia ou captura do comprovativo." };
    const ext = ALLOWED[file.type];
    if (!ext) return { error: "O comprovativo tem de ser uma imagem (JPG, PNG, WEBP) ou PDF." };
    if (file.size > MAX_BYTES) return { error: "Ficheiro demasiado grande (máximo 5 MB)." };
    const bytes = Buffer.from(await file.arrayBuffer());

    const common = {
      userId: user.id,
      method: data.method,
      payerPhone: data.payerPhone,
      transactionRef: data.transactionRef,
      proofHash: sha256(bytes),
      storeProof: async () => {
        const key = newKey("proofs", ext);
        await putObject("private", key, bytes, file.type);
        return key;
      },
    };
    if (data.kind === "EPISODE") await createEpisodePaymentRequest(db, { ...common, episodeId: data.episodeId ?? "" });
    else if (data.kind === "WEEKLY_PASS") await createPassPaymentRequest(db, common);
    else await createGiftPaymentRequest(db, { ...common, artistId: data.artistId ?? "", giftId: data.giftId ?? "" });
  } catch (e) {
    return toActionError(e);
  }
  redirect("/conta?pedido=enviado");
}

/** Desbloquear um episódio com 100 pontos de fã. */
export async function redeemPointsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const episodeId = String(fd.get("episodeId") ?? "");
  try {
    const user = await requireUser();
    await redeemEpisodeWithPoints(db, { userId: user.id, episodeId });
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/ver/${episodeId}`);
}
