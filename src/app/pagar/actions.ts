"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { phoneSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import { newKey, putObject, sha256 } from "@/domain/storage";
import { createCoinPaymentRequest } from "@/domain/payments/service";
import type { ActionResult } from "@/components/ActionForm";

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  packId: z.string().min(1, "Escolhe um pacote."),
  method: z.enum(["MULTICAIXA_EXPRESS", "BANK_TRANSFER"], { errorMap: () => ({ message: "Escolhe como pagaste." }) }),
  payerPhone: phoneSchema,
  transactionRef: z.string().trim().min(4, "Indica o número da operação que aparece no comprovativo.").max(60),
  voltar: z.string().optional(),
});

/** Compra de um pacote de moedas com comprovativo (as moedas entram quando o admin confirmar). */
export async function submitPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let back = "";
  try {
    const user = await requireUser();
    const g = (k: string) => (fd.get(k) === null ? undefined : String(fd.get(k)));
    const data = schema.parse({ packId: g("packId"), method: g("method"), payerPhone: g("payerPhone"), transactionRef: g("transactionRef"), voltar: g("voltar") });
    const file = fd.get("proof");
    if (!(file instanceof File) || file.size === 0) return { error: "Carrega a fotografia ou captura do comprovativo." };
    const ext = ALLOWED[file.type];
    if (!ext) return { error: "O comprovativo tem de ser uma imagem (JPG, PNG, WEBP) ou PDF." };
    if (file.size > MAX_BYTES) return { error: "Ficheiro demasiado grande (máximo 5 MB)." };
    const bytes = Buffer.from(await file.arrayBuffer());
    await createCoinPaymentRequest(db, {
      userId: user.id,
      packId: data.packId,
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
    if (data.voltar?.startsWith("/") && !data.voltar.startsWith("//")) back = `&voltar=${encodeURIComponent(data.voltar)}`;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/loja?pedido=enviado${back}`);
}
