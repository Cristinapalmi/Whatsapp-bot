"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { toggleFollow } from "@/domain/artists/growth";

/** Seguir / deixar de seguir um artista. */
export async function toggleFollowAction(artistId: string): Promise<{ ok: boolean; following?: boolean; login?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, login: true };
  const artist = await db.artistProfile.findUnique({ where: { id: artistId }, select: { userId: true, slug: true, status: true } });
  if (!artist || artist.status !== "APPROVED" || artist.userId === user.id) return { ok: false };
  const following = await toggleFollow(db, user.id, artistId);
  revalidatePath(`/${artist.slug}`);
  return { ok: true, following };
}
