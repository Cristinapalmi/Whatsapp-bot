"use server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { UserFacingError } from "@/domain/errors";
import { completeAdView, startAdView } from "@/domain/ads/service";
import { getObjectUrl } from "@/domain/storage";

type Fail = { ok: false; error: string; code?: string };
const fail = (e: unknown): Fail => {
  if (e instanceof UserFacingError) return { ok: false, error: e.message, code: e.code };
  console.error(e);
  return { ok: false, error: "Ocorreu um erro. Tenta outra vez." };
};

/** Começa o anúncio (o servidor regista a hora de início). */
export async function startAdAction(episodeId: string): Promise<
  { ok: true; viewId: string; videoUrl: string; durationSec: number; sponsor: string; linkUrl: string | null } | Fail
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra na tua conta para usar a oferta.", code: "LOGIN" };
  try {
    const { view, creative } = await startAdView(db, { userId: user.id, episodeId });
    return {
      ok: true,
      viewId: view.id,
      videoUrl: await getObjectUrl("media", creative.videoKey, 900),
      durationSec: creative.durationSec,
      sponsor: creative.sponsor,
      linkUrl: creative.linkUrl,
    };
  } catch (e) {
    return fail(e);
  }
}

/** Termina o anúncio: o servidor confirma o tempo e desbloqueia o episódio. */
export async function completeAdAction(viewId: string): Promise<{ ok: true } | Fail> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra na tua conta.", code: "LOGIN" };
  try {
    await completeAdView(db, { userId: user.id, viewId });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
