"use server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { checkPaymentProof } from "@/domain/payments/proof-check";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { phoneSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import { newKey, putObject, sha256 } from "@/domain/storage";
import { createCoinPaymentRequest } from "@/domain/payments/service";
import type { ActionResult } from "@/components/ActionForm";
import { readValidatedFile } from "@/lib/filetype";

const MAX_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  packId: z.string().min(1, "Escolhe um pacote."),
  method: z.enum(["MULTICAIXA_EXPRESS", "BANK_TRANSFER"], { error: "Escolhe como pagaste." }),
  payerPhone: phoneSchema,
  transactionRef: z.string().trim().min(4, "Indica o número da operação que aparece no comprovativo.").max(60),
  voltar: z.string().optional(),
});

/** Valida o formulário e cria o pedido de compra. Devolve uma mensagem de erro ou null. */
async function processCoinPurchase(fd: FormData): Promise<{ error: string } | { voltar?: string }> {
  const user = await requireUser();
  const g = (k: string) => (fd.get(k) === null ? undefined : String(fd.get(k)));
  const data = schema.parse({ packId: g("packId"), method: g("method"), payerPhone: g("payerPhone"), transactionRef: g("transactionRef"), voltar: g("voltar") });
  const file = fd.get("proof");
  if (!(file instanceof File) || file.size === 0) return { error: "Carrega a fotografia ou captura do comprovativo." };
  // Tipo REAL do ficheiro (pelos primeiros bytes), não o que o navegador diz
  const checked = await readValidatedFile(file, ["jpeg", "png", "webp", "pdf"], MAX_BYTES, "Comprovativo").catch((e: Error) => ({ error: e.message }));
  if ("error" in checked) return { error: `${checked.error} Usa uma imagem (JPG, PNG, WEBP) ou PDF.` };
  const bytes = checked.bytes;
  const ext = checked.type === "jpeg" ? "jpg" : checked.type!;
  const mime = checked.type === "pdf" ? "application/pdf" : `image/${checked.type}`;
  const created = await createCoinPaymentRequest(db, {
    userId: user.id,
    packId: data.packId,
    method: data.method,
    payerPhone: data.payerPhone,
    transactionRef: data.transactionRef,
    proofHash: sha256(bytes),
    storeProof: async () => {
      const key = newKey("proofs", ext);
      await putObject("private", key, bytes, mime);
      return key;
    },
  });
  // Verificação do comprovativo DEPOIS de responder ao fã (só marca suspeito; nunca decide sozinha)
  const proofType = checked.type!;
  after(() => checkPaymentProof(db, created.id, bytes, proofType).catch((e) => console.error("[comprovativo]", e)));
  return { voltar: data.voltar };
}

/** Compra de um pacote de moedas com comprovativo (as moedas entram quando o admin confirmar). */
export async function submitPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let back = "";
  try {
    const r = await processCoinPurchase(fd);
    if ("error" in r) return r;
    if (r.voltar?.startsWith("/") && !r.voltar.startsWith("//")) back = `&voltar=${encodeURIComponent(r.voltar)}`;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/loja?pedido=enviado${back}`);
}

/** O mesmo, mas sem sair do episódio (painel de desbloqueio). */
export async function submitPaymentInlineAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const r = await processCoinPurchase(fd);
    if ("error" in r) return r;
    return { ok: "Comprovativo enviado! As moedas entram assim que confirmarmos o pagamento." };
  } catch (e) {
    return toActionError(e);
  }
}
