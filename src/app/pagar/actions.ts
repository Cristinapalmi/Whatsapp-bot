"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { phoneSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import { newKey, putObject, sha256 } from "@/domain/storage";
import { createEpisodePaymentRequest } from "@/domain/payments/service";
import type { ActionResult } from "@/components/ActionForm";

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  episodeId: z.string().min(1),
  method: z.enum(["MULTICAIXA_EXPRESS", "BANK_TRANSFER"], { errorMap: () => ({ message: "Escolhe como pagaste." }) }),
  payerPhone: phoneSchema,
  transactionRef: z.string().trim().min(4, "Indica o número da operação que aparece no comprovativo.").max(60),
});

export async function submitPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = schema.parse({
      episodeId: fd.get("episodeId"),
      method: fd.get("method"),
      payerPhone: fd.get("payerPhone"),
      transactionRef: fd.get("transactionRef"),
    });
    const file = fd.get("proof");
    if (!(file instanceof File) || file.size === 0) return { error: "Carrega a fotografia ou captura do comprovativo." };
    const ext = ALLOWED[file.type];
    if (!ext) return { error: "O comprovativo tem de ser uma imagem (JPG, PNG, WEBP) ou PDF." };
    if (file.size > MAX_BYTES) return { error: "Ficheiro demasiado grande (máximo 5 MB)." };
    const bytes = Buffer.from(await file.arrayBuffer());

    await createEpisodePaymentRequest(db, {
      userId: user.id,
      episodeId: data.episodeId,
      method: data.method,
      payerPhone: data.payerPhone,
      transactionRef: data.transactionRef,
      proofHash: sha256(bytes),
      storeProof: async () => {
        const key = newKey("proofs", ext);
        await putObject("private", key, bytes, file.type);
        return key;
      },
    });
  } catch (e) {
    return toActionError(e);
  }
  redirect("/conta?pedido=enviado");
}
