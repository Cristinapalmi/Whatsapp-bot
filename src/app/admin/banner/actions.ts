"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toActionError } from "@/lib/actions";
import { readValidatedFile, sniff } from "@/lib/filetype";
import { audit } from "@/domain/notify";
import { UserFacingError } from "@/domain/errors";
import { deleteObject, getUploadUrl, newKey, putObject, readObject } from "@/domain/storage";
import { BANNER_VIDEO_MAX_BYTES, BANNER_VIDEO_MAX_SEC, CTA_KINDS, mp4DurationSec } from "@/domain/banner";
import { setSetting } from "@/domain/coins/service";
import type { ActionResult } from "@/components/ActionForm";

const day = (v: unknown, end = false) => {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T${end ? "23:59:59" : "00:00:00"}+01:00`) : null;
};

const schema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, "Escreve o título.").max(60),
  subtitle: z.string().trim().max(160).optional(),
  highlightWord: z.string().trim().max(40).optional(),
  ctaText: z.string().trim().max(30).optional(),
  ctaKind: z.enum(CTA_KINDS),
  ctaTarget: z.string().trim().max(200).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.literal("on").optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

/** Criar ou guardar um slide (com imagem opcional). */
export async function saveSlideAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const d = schema.parse(Object.fromEntries(fd));
    let ctaTarget = d.ctaTarget || null;
    if (d.ctaKind === "SERIES") {
      const s = ctaTarget ? await db.series.findFirst({ where: { OR: [{ slug: ctaTarget }, { id: ctaTarget }], status: "PUBLISHED" } }) : null;
      if (!s) return { error: "Escolhe uma série publicada para o botão." };
      ctaTarget = s.slug;
    }
    if (d.ctaKind === "LINK" && (!ctaTarget || !ctaTarget.startsWith("/") || ctaTarget.startsWith("//"))) return { error: "O link do botão tem de ser interno (começar por /, ex.: /ranking)." };
    if (d.ctaKind !== "NONE" && !d.ctaText) return { error: "Escreve o texto do botão." };
    // Palavra em dourado que não está no título: ignora-se (usa-se a última palavra), sem dar erro
    if (d.highlightWord && !d.title.toLocaleUpperCase("pt").includes(d.highlightWord.toLocaleUpperCase("pt"))) d.highlightWord = undefined;
    let imageKey: string | undefined;
    const img = fd.get("image");
    if (img instanceof File && img.size > 0) {
      const f = await readValidatedFile(img, ["jpeg", "png", "webp"], 3 * 1024 * 1024, "Imagem").catch((e: Error) => ({ error: e.message }));
      if ("error" in f) return { error: `${f.error} Usa JPG, PNG ou WEBP até 3 MB.` };
      imageKey = newKey("banner", f.type === "jpeg" ? "jpg" : f.type!);
      await putObject("media", imageKey, f.bytes, `image/${f.type}`);
    }
    const data = {
      title: d.title, subtitle: d.subtitle || null, highlightWord: d.highlightWord || null, ctaText: d.ctaText || null, ctaKind: d.ctaKind, ctaTarget,
      sortOrder: d.sortOrder, active: !!d.active, startsAt: day(d.startsAt), endsAt: day(d.endsAt, true),
      ...(imageKey ? { imageKey } : {}),
    };
    if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) return { error: "A data de fim é antes da data de início." };
    if (d.id) {
      const old = await db.bannerSlide.findUniqueOrThrow({ where: { id: d.id } });
      await db.bannerSlide.update({ where: { id: d.id }, data });
      if (imageKey && old.imageKey) await deleteObject("media", old.imageKey).catch(() => {});
    } else {
      if (!imageKey) return { error: "Carrega a imagem do slide (também serve de capa do vídeo)." };
      await db.bannerSlide.create({ data });
    }
    await audit(db, admin.id, "BANNER_SAVED", "BannerSlide", d.id ?? "new", { title: d.title });
    revalidatePath("/admin/banner");
    revalidatePath("/");
    return { ok: "Slide guardado." };
  } catch (e) { return toActionError(e); }
}

export async function deleteSlideAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const s = await db.bannerSlide.delete({ where: { id: String(fd.get("id")) } });
    for (const k of [s.imageKey, s.videoKey]) if (k) await deleteObject("media", k).catch(() => {});
    await audit(db, admin.id, "BANNER_DELETED", "BannerSlide", s.id, {});
    revalidatePath("/admin/banner");
    revalidatePath("/");
    return { ok: "Slide apagado." };
  } catch (e) { return toActionError(e); }
}

export async function removeSlideVideoAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const s = await db.bannerSlide.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
    if (s.videoKey) await deleteObject("media", s.videoKey).catch(() => {});
    await db.bannerSlide.update({ where: { id: s.id }, data: { videoKey: null, videoSec: null } });
    revalidatePath("/admin/banner");
    revalidatePath("/");
    return { ok: "Vídeo retirado (fica a imagem)." };
  } catch (e) { return toActionError(e); }
}

/** Vídeo do slide: envio direto do navegador, verificado aqui no servidor (MP4, até 8 MB e 20 s). */
export async function startSlideVideoUpload(slideId: string, contentType: string, size: number) {
  try {
    await requireAdmin();
    if (contentType !== "video/mp4") throw new UserFacingError("O vídeo do banner tem de ser MP4.");
    if (!(size > 0) || size > BANNER_VIDEO_MAX_BYTES) throw new UserFacingError(`O vídeo tem ${(size / 1048576).toFixed(1)} MB; o máximo é 8 MB.`);
    await db.bannerSlide.findUniqueOrThrow({ where: { id: slideId } });
    const key = newKey(`banner/${slideId}`, "mp4");
    return { ok: true as const, key, url: await getUploadUrl("media", key, contentType) };
  } catch (e) {
    return { ok: false as const, error: e instanceof UserFacingError ? e.message : "Erro ao preparar o envio." };
  }
}

export async function finishSlideVideoUpload(slideId: string, key: string) {
  try {
    const admin = await requireAdmin();
    if (!key.startsWith(`banner/${slideId}/`)) throw new UserFacingError("Envio inválido.");
    const buf = await readObject("media", key, BANNER_VIDEO_MAX_BYTES);
    const dur = buf && sniff(new Uint8Array(buf.subarray(0, 32))) === "mp4" ? mp4DurationSec(buf) : null;
    if (!buf || dur === null || dur > BANNER_VIDEO_MAX_SEC + 0.5) {
      await deleteObject("media", key).catch(() => {});
      throw new UserFacingError(!buf ? "O vídeo passa de 8 MB." : dur === null ? "Não é um vídeo MP4 válido." : `O vídeo tem ${Math.round(dur)} s; o máximo é ${BANNER_VIDEO_MAX_SEC} s.`);
    }
    const old = await db.bannerSlide.findUniqueOrThrow({ where: { id: slideId } });
    await db.bannerSlide.update({ where: { id: slideId }, data: { videoKey: key, videoSec: Math.round(dur) } });
    if (old.videoKey && old.videoKey !== key) await deleteObject("media", old.videoKey).catch(() => {});
    await audit(db, admin.id, "BANNER_VIDEO", "BannerSlide", slideId, { sec: Math.round(dur) });
    revalidatePath("/admin/banner");
    revalidatePath("/");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof UserFacingError ? e.message : "Erro ao confirmar o envio." };
  }
}

/** Imagem da "Área dos criadores" (foto real e autorizada). */
export async function saveCreatorsImageAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const img = fd.get("image");
    if (!(img instanceof File) || img.size === 0) return { error: "Escolhe a imagem." };
    const f = await readValidatedFile(img, ["jpeg", "png", "webp"], 5 * 1024 * 1024, "Imagem").catch((e: Error) => ({ error: e.message }));
    if ("error" in f) return { error: `${f.error} Usa JPG, PNG ou WEBP até 5 MB.` };
    const key = newKey("banner/criadores", f.type === "jpeg" ? "jpg" : f.type!);
    await putObject("media", key, f.bytes, `image/${f.type}`);
    const old = await db.setting.findUnique({ where: { key: "creatorsImageKey" } });
    await setSetting(db, "creatorsImageKey", key);
    if (old?.value) await deleteObject("media", old.value).catch(() => {});
    await audit(db, admin.id, "CREATORS_IMAGE", "Setting", "creatorsImageKey", {});
    revalidatePath("/admin/banner");
    revalidatePath("/");
    return { ok: "Imagem da Área dos criadores atualizada." };
  } catch (e) { return toActionError(e); }
}
