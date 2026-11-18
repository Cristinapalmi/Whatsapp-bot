import "server-only";
import { db } from "./db";
import { getAdminForApi, getCurrentUser } from "./auth";

/** Quem pode ver um extrato: o próprio artista, ou a administração (qualquer artista). */
export async function resolveStatementArtist(requestedId?: string | null) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "ADMIN" && requestedId) {
    if (!(await getAdminForApi())) return null; // admin só com o 2.º passo feito
    return db.artistProfile.findUnique({ where: { id: requestedId } });
  }
  return db.artistProfile.findUnique({ where: { userId: user.id } });
}
