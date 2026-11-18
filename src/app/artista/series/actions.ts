"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { toActionError } from "@/lib/actions";
import { MAX_VIDEO_BYTES, readValidatedFile, sniff } from "@/lib/filetype";
import { deleteObject, getUploadUrl, inspectObject, newKey, putObject } from "@/domain/storage";
import { UserFacingError } from "@/domain/errors";
import {
  addEpisode, createSeriesDraft, deleteEpisode, getOwnedEpisode, getOwnedSeries, isEpisodeEditable, moveEpisode, submitForReview, updateEpisode, updateSeriesDetails,
} from "@/domain/series-workflow";
import type { ActionResult } from "@/components/ActionForm";

const CATEGORIES = ["TERROR", "COMEDIA", "DRAMA", "MAKAS_FAMILIA", "ROMANCE", "ACAO", "OUTRO"] as const;
const detailsSchema = z.object({
  title: z.string().trim().min(2, "Indica o título.").max(80),
  synopsis: z.string().trim().max(600).default(""),
  category: z.enum(CATEGORIES),
  plannedEpisodes: z.coerce.number().int().min(1, "Mínimo 1 episódio.").max(200),
});

async function storeCover(fd: FormData) {
  const file = fd.get("cover");
  if (!(file instanceof File) || file.size === 0) return null;
  const { bytes, type } = await readValidatedFile(file, ["jpeg", "png", "webp"], 3 * 1024 * 1024, "Capa").catch((e: Error) => {
    throw new UserFacingError(e.message);
  });
  const key = newKey("covers", type === "jpeg" ? "jpg" : type!);
  await putObject("media", key, bytes, `image/${type}`);
  return key;
}

export async function createSeriesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = "";
  try {
    const { artist } = await requireArtist({ approved: true });
    const d = detailsSchema.parse(Object.fromEntries(fd));
    const coverKey = await storeCover(fd);
    id = (await createSeriesDraft(db, artist.id, { ...d, coverKey })).id;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/artista/series/${id}?criada=1`);
}

export async function saveSeriesDetailsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const seriesId = String(fd.get("seriesId") ?? "");
    const d = detailsSchema.parse(Object.fromEntries(fd));
    await getOwnedSeries(db, artist.id, seriesId);
    const coverKey = await storeCover(fd);
    await updateSeriesDetails(db, artist.id, seriesId, { ...d, coverKey });
    revalidatePath(`/artista/series/${seriesId}`);
    return { ok: "Guardado." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addEpisodeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const seriesId = String(fd.get("seriesId") ?? "");
    const title = z.string().trim().min(1, "Indica o título do episódio.").max(100).parse(fd.get("title"));
    const e = await addEpisode(db, artist.id, seriesId, title);
    revalidatePath(`/artista/series/${seriesId}`);
    return { ok: `Episódio ${e.number} criado. Agora carrega o vídeo.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveEpisodeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const d = z
      .object({
        episodeId: z.string(),
        title: z.string().trim().min(1, "Indica o título.").max(100),
        endsWithHook: z.literal("on").optional(),
        hookText: z.string().trim().max(200).optional(),
      })
      .parse(Object.fromEntries(fd));
    const ep = await getOwnedEpisode(db, artist.id, d.episodeId);
    let subtitlesKey: string | undefined;
    const subs = fd.get("subtitles");
    if (subs instanceof File && subs.size > 0) {
      const { bytes } = await readValidatedFile(subs, ["vtt"], 512 * 1024, "Legendas").catch((e: Error) => {
        throw new UserFacingError(`${e.message} Usa um ficheiro .vtt.`);
      });
      subtitlesKey = newKey(`subtitles/${ep.seriesId}`, "vtt");
      await putObject("media", subtitlesKey, bytes, "text/vtt");
    }
    await updateEpisode(db, artist.id, ep.id, { title: d.title, endsWithHook: !!d.endsWithHook, hookText: d.hookText || null, subtitlesKey });
    revalidatePath(`/artista/series/${ep.seriesId}`);
    return { ok: "Episódio guardado." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moveEpisodeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const ep = await moveEpisode(db, artist.id, String(fd.get("episodeId")), fd.get("dir") === "up" ? "up" : "down");
    revalidatePath(`/artista/series/${ep.seriesId}`);
    return null;
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteEpisodeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const ep = await getOwnedEpisode(db, artist.id, String(fd.get("episodeId")));
    const { keys } = await deleteEpisode(db, artist.id, ep.id);
    for (const k of keys) await deleteObject("media", k).catch(() => {});
    revalidatePath(`/artista/series/${ep.seriesId}`);
    return { ok: "Episódio apagado." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitForReviewAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const seriesId = String(fd.get("seriesId") ?? "");
  let qs = "";
  try {
    const { artist } = await requireArtist({ approved: true });
    const r = await submitForReview(db, artist.id, seriesId);
    qs = `enviado=${r.episodes}${r.missingVideo ? `&semvideo=${r.missingVideo}` : ""}`;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/artista/series/${seriesId}?${qs}`);
}

// ---------- Envio direto de vídeos (episódio ou trailer) ----------
type Kind = "episode" | "trailer";

async function ownedTarget(artistId: string, targetId: string, kind: Kind) {
  if (kind === "trailer") {
    const s = await getOwnedSeries(db, artistId, targetId);
    return { seriesId: s.id };
  }
  const e = await getOwnedEpisode(db, artistId, targetId);
  if (!isEpisodeEditable(e.status)) throw new UserFacingError("Este episódio já foi enviado ou publicado.");
  return { seriesId: e.seriesId };
}

export async function startArtistVideoUpload(targetId: string, kind: Kind, contentType: string, size: number) {
  try {
    const { artist } = await requireArtist({ approved: true });
    if (!["video/mp4", "video/webm"].includes(contentType)) throw new UserFacingError("O vídeo tem de ser MP4.");
    if (!(size > 0) || size > MAX_VIDEO_BYTES) throw new UserFacingError(`O vídeo tem ${(size / 1048576).toFixed(1)} MB; o máximo é 50 MB.`);
    const { seriesId } = await ownedTarget(artist.id, targetId, kind);
    const key = newKey(`${kind === "trailer" ? "trailers" : "videos"}/${seriesId}`, contentType === "video/webm" ? "webm" : "mp4");
    return { ok: true as const, key, url: await getUploadUrl("media", key, contentType) };
  } catch (e) {
    return { ok: false as const, error: e instanceof UserFacingError ? e.message : "Erro ao preparar o envio." };
  }
}

export async function finishArtistVideoUpload(targetId: string, kind: Kind, key: string, durationSec: number) {
  try {
    const { artist } = await requireArtist({ approved: true });
    const { seriesId } = await ownedTarget(artist.id, targetId, kind);
    const prefix = `${kind === "trailer" ? "trailers" : "videos"}/${seriesId}/`;
    if (!key.startsWith(prefix)) throw new UserFacingError("Envio inválido.");
    // Confirmar NO SERVIDOR que é mesmo um vídeo e que não passa do limite
    const info = await inspectObject("media", key);
    const type = info ? sniff(info.head) : null;
    if (!info || (type !== "mp4" && type !== "webm") || info.size > MAX_VIDEO_BYTES) {
      await deleteObject("media", key).catch(() => {});
      throw new UserFacingError("O ficheiro enviado não é um vídeo MP4 válido (ou passa de 50 MB).");
    }
    if (kind === "trailer") await db.series.update({ where: { id: seriesId }, data: { trailerKey: key, trailerUpdatedAt: new Date() } });
    else await db.episode.update({ where: { id: targetId }, data: { videoKey: key, ...(durationSec > 0 ? { durationSec: Math.round(durationSec) } : {}) } });
    revalidatePath(`/artista/series/${seriesId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof UserFacingError ? e.message : "Erro ao confirmar o envio." };
  }
}
