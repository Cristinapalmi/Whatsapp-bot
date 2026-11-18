"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { UserFacingError } from "@/domain/errors";
import { sendGiftWithCoins, unlockEpisodeWithCoins, unlockSeasonWithCoins } from "@/domain/coins/service";
import { redeemEpisodeWithPoints } from "@/domain/points";

export type UnlockResult = { ok: true; message?: string } | { ok: false; error: string; code?: string };

function fail(e: unknown): UnlockResult {
  if (e instanceof UserFacingError) return { ok: false, error: e.message, code: e.code };
  console.error(e);
  return { ok: false, error: "Ocorreu um erro. Tenta outra vez." };
}

/** Desbloquear um episódio com moedas. Repetir o clique nunca cobra duas vezes. */
export async function unlockEpisodeAction(episodeId: string): Promise<UnlockResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra na tua conta para desbloquear.", code: "LOGIN" };
  try {
    await unlockEpisodeWithCoins(db, { userId: user.id, episodeId });
    revalidatePath(`/ver/${episodeId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof UserFacingError && e.code === "ALREADY_UNLOCKED") return { ok: true };
    return fail(e);
  }
}

/** Desbloquear todos os episódios restantes da série (com desconto). Uma só cobrança. */
export async function unlockSeasonAction(seriesId: string): Promise<UnlockResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra na tua conta para desbloquear.", code: "LOGIN" };
  try {
    const r = await unlockSeasonWithCoins(db, { userId: user.id, seriesId });
    return { ok: true, message: `${r.count} episódios desbloqueados!` };
  } catch (e) {
    if (e instanceof UserFacingError && e.code === "ALREADY_UNLOCKED") return { ok: true };
    return fail(e);
  }
}

/** Desbloquear um episódio com 100 pontos de fã. */
export async function redeemPointsAction(episodeId: string): Promise<UnlockResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra na tua conta.", code: "LOGIN" };
  try {
    await redeemEpisodeWithPoints(db, { userId: user.id, episodeId });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Oferecer um presente (pago com moedas). */
export async function sendGiftAction(artistId: string, giftCode: string): Promise<UnlockResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra na tua conta para oferecer presentes.", code: "LOGIN" };
  try {
    await sendGiftWithCoins(db, { userId: user.id, artistId, giftCode });
    return { ok: true, message: "Presente entregue. Obrigado pelo apoio!" };
  } catch (e) {
    return fail(e);
  }
}
