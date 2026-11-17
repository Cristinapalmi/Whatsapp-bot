"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { toActionError } from "@/lib/actions";
import type { ActionResult } from "@/components/ActionForm";

const schema = z.object({
  seriesId: z.string().min(1),
  reason: z.string().min(2).max(100),
  details: z.string().max(1000).optional(),
});

export async function reportAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "Entra na tua conta para denunciar." };
    const data = schema.parse(Object.fromEntries(fd));
    const recent = await db.report.count({ where: { reporterId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recent >= 5) return { error: "Já enviaste várias denúncias. Tenta mais tarde." };
    await db.report.create({ data: { reporterId: user.id, seriesId: data.seriesId, reason: data.reason, details: data.details || null } });
    return { ok: "Obrigado. A nossa equipa vai analisar." };
  } catch (e) {
    return toActionError(e);
  }
}
