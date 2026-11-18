"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { toActionError } from "@/lib/actions";
import type { ActionResult } from "@/components/ActionForm";

const link = (host: RegExp, msg: string) =>
  z.union([z.literal(""), z.string().trim().url(msg).refine((v) => v.startsWith("https://") && host.test(new URL(v).hostname), msg)]);

const schema = z.object({
  tiktokUrl: link(/(^|\.)tiktok\.com$/, "Link do TikTok inválido (https://www.tiktok.com/@...)."),
  instagramUrl: link(/(^|\.)instagram\.com$/, "Link do Instagram inválido (https://www.instagram.com/...)."),
  bio: z.string().trim().max(300),
});

/** Links e bio do perfil público do artista. */
export async function saveArtistLinksAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const d = schema.parse({ tiktokUrl: fd.get("tiktokUrl") ?? "", instagramUrl: fd.get("instagramUrl") ?? "", bio: fd.get("bio") ?? "" });
    await db.artistProfile.update({ where: { id: artist.id }, data: { tiktokUrl: d.tiktokUrl || null, instagramUrl: d.instagramUrl || null, bio: d.bio || null } });
    revalidatePath(`/${artist.slug}`);
    return { ok: "Perfil guardado." };
  } catch (e) { return toActionError(e); }
}

/** Definições: "Avisar-me a cada desbloqueio" (desligado por defeito). */
export async function setNotifyEachUnlockAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const on = fd.get("on") === "1";
    await db.artistProfile.update({ where: { id: artist.id }, data: { notifyEachUnlock: on } });
    revalidatePath("/artista");
    return { ok: on ? "Vais receber um aviso a cada desbloqueio." : "Avisos a cada desbloqueio desligados. Continuas a receber o resumo diário." };
  } catch (e) { return toActionError(e); }
}
