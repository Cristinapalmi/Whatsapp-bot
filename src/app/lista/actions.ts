"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Junta/retira uma série de "A minha lista". */
export async function toggleFavoriteAction(seriesId: string): Promise<{ ok: boolean; saved?: boolean; login?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, login: true };
  const key = { userId_seriesId: { userId: user.id, seriesId } };
  const exists = await db.favorite.findUnique({ where: key });
  if (exists) await db.favorite.delete({ where: key });
  else {
    const series = await db.series.findFirst({ where: { id: seriesId, status: "PUBLISHED" }, select: { id: true } });
    if (!series) return { ok: false };
    await db.favorite.create({ data: { userId: user.id, seriesId } });
  }
  revalidatePath("/lista");
  return { ok: true, saved: !exists };
}
