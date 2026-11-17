"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { isValidAngolanIban, normalizeIban } from "@/lib/iban";
import { normalizeAngolanPhone } from "@/lib/phone";
import { kzToCents } from "@/lib/money";
import { toActionError } from "@/lib/actions";
import { requestPayout } from "@/domain/payouts/service";
import type { ActionResult } from "@/components/ActionForm";

const sameName = (a: string, b: string) =>
  a.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim() ===
  b.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export async function savePayoutAccountAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const data = z
      .object({
        method: z.enum(["BANK_IBAN", "MULTICAIXA_EXPRESS"]),
        holderName: z.string().trim().min(3, "Indica o nome do titular."),
        bankName: z.string().trim().optional(),
        iban: z.string().optional(),
        mcxPhone: z.string().optional(),
      })
      .parse(Object.fromEntries(fd));
    if (!sameName(data.holderName, artist.fullName))
      return { error: `O titular tem de ser igual ao teu nome completo registado: "${artist.fullName}".` };

    let iban: string | null = null;
    let mcxPhone: string | null = null;
    if (data.method === "BANK_IBAN") {
      if (!data.iban || !isValidAngolanIban(data.iban))
        return { error: "IBAN inválido. Um IBAN angolano tem o formato AO06 seguido de 21 dígitos." };
      if (!data.bankName) return { error: "Indica o banco." };
      iban = normalizeIban(data.iban);
    } else {
      mcxPhone = data.mcxPhone ? normalizeAngolanPhone(data.mcxPhone) : null;
      if (!mcxPhone) return { error: "Número Multicaixa Express inválido." };
    }
    const values = { holderName: data.holderName, method: data.method, bankName: data.method === "BANK_IBAN" ? data.bankName : null, iban, mcxPhone };
    await db.payoutAccount.upsert({ where: { artistId: artist.id }, create: { artistId: artist.id, ...values }, update: values });
    revalidatePath("/artista/carteira");
    return { ok: "Conta guardada." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestPayoutAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const kz = Number(String(fd.get("amount") ?? "").replace(/[^\d]/g, ""));
    if (!kz) return { error: "Indica o valor a levantar." };
    await requestPayout(db, { artistId: artist.id, amountCents: kzToCents(kz) });
    revalidatePath("/artista/carteira");
    return { ok: "Pedido enviado. Estado: Em processamento." };
  } catch (e) {
    return toActionError(e);
  }
}
