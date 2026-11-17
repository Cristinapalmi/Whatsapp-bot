"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/artist";
import { slugify } from "@/lib/slug";
import { urlSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import { notify } from "@/domain/notify";
import type { ActionResult } from "@/components/ActionForm";

const schema = z.object({
  title: z.string().trim().min(2, "Indica o nome da série.").max(80),
  socialUrl: urlSchema,
  plannedEpisodes: z.coerce.number().int().min(2, "Uma série tem pelo menos 2 episódios.").max(100),
  category: z.enum(["TERROR", "COMEDIA", "DRAMA", "MAKAS_FAMILIA", "ROMANCE", "ACAO", "OUTRO"]),
  synopsis: z.string().trim().max(600).optional(),
});

export async function submitSeriesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { artist } = await requireArtist({ approved: true });
    const data = schema.parse(Object.fromEntries(fd));
    const base = slugify(data.title) || "serie";
    let slug = base;
    for (let i = 2; await db.series.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    await db.series.create({
      data: {
        artistId: artist.id,
        title: data.title,
        slug,
        socialUrl: data.socialUrl,
        plannedEpisodes: data.plannedEpisodes,
        category: data.category,
        synopsis: data.synopsis ?? "",
        status: "IN_REVIEW",
      },
    });
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const a of admins) await notify(db, a.id, "Nova série para análise", `${artist.stageName}: "${data.title}"`, "/admin/series");
  } catch (e) {
    return toActionError(e);
  }
  redirect("/artista");
}
