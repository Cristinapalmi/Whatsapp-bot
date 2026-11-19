import type { PrismaClient } from "@prisma/client";
import { UserFacingError } from "../errors";
import { audit } from "../notify";

/**
 * APAGAR UM ARTISTA (Admin → Artistas), com confirmação.
 *  - Só para artistas SEM levantamentos pagos (nem em processamento). Nunca para contas de admin.
 *  - Sem nenhum registo de dinheiro: apaga o artista, as séries (e os ficheiros) e, se a pessoa não
 *    comprou moedas, a própria conta.
 *  - Com registos de dinheiro (vendas, compras, livro-razão): esses registos NUNCA se apagam.
 *    Retiram-se as séries (ficheiros apagados), a conta de artista fica suspensa e o login desativado.
 */
export async function deleteArtist(db: PrismaClient, adminId: string, artistId: string, del: (key: string) => Promise<unknown> = async () => {}) {
  const artist = await db.artistProfile.findUnique({ where: { id: artistId }, include: { user: true, series: { include: { episodes: true } } } });
  if (!artist) throw new UserFacingError("Artista não encontrado.");
  if (artist.user.role === "ADMIN") throw new UserFacingError("Não se pode apagar a conta de administração.");
  const payouts = await db.payoutRequest.count({ where: { artistId, status: { in: ["PAID", "PROCESSING"] } } });
  if (payouts > 0) throw new UserFacingError("Este artista tem levantamentos pagos ou em processamento — não se pode apagar.");

  const keys = artist.series.flatMap((s) => [s.coverKey, s.trailerKey, ...s.episodes.flatMap((e) => [e.videoKey, e.videoKeyHd, e.subtitlesKey])]).filter((k): k is string => !!k && !k.startsWith("/"));
  if (artist.photoKey && !artist.photoKey.startsWith("/")) keys.push(artist.photoKey);

  const [spends, payments, lines, adUnlocks] = await Promise.all([
    db.coinSpend.count({ where: { artistId } }),
    db.paymentRequest.count({ where: { artistId } }),
    db.ledgerLine.count({ where: { account: { artistId } } }),
    db.adUnlock.count({ where: { artistId } }),
  ]);
  const hasMoney = spends + payments + lines + adUnlocks > 0;

  if (!hasMoney) {
    const userHasPurchases = (await db.paymentRequest.count({ where: { userId: artist.userId } })) + (await db.coinLot.count({ where: { userId: artist.userId } })) > 0;
    await db.$transaction(async (tx) => {
      await tx.setting.deleteMany({ where: { key: "suggestedSeriesId", value: { in: artist.series.map((s) => s.id) } } });
      await tx.series.deleteMany({ where: { artistId } });
      await tx.ledgerAccount.deleteMany({ where: { artistId } }); // contas sem movimentos
      await tx.payoutAccount.deleteMany({ where: { artistId } });
      await tx.payoutRequest.deleteMany({ where: { artistId } }); // só rejeitados (os pagos/em curso bloqueiam acima)
      await tx.artistProfile.delete({ where: { id: artistId } });
      if (userHasPurchases) await tx.user.update({ where: { id: artist.userId }, data: { role: "PUBLIC" } });
      else await tx.user.delete({ where: { id: artist.userId } });
    });
    for (const k of keys) await del(k).catch(() => {});
    await audit(db, adminId, "ARTIST_DELETED", "ArtistProfile", artistId, { stageName: artist.stageName, series: artist.series.length, userDeleted: !userHasPurchases });
    return { mode: "deleted" as const, series: artist.series.length };
  }

  // Há registos de dinheiro: nada disso se apaga. Retirar séries, apagar ficheiros, suspender.
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.setting.deleteMany({ where: { key: "suggestedSeriesId", value: { in: artist.series.map((s) => s.id) } } });
    await tx.episode.updateMany({ where: { series: { artistId } }, data: { videoKey: null, videoKeyHd: null, subtitlesKey: null, published: false } });
    await tx.series.updateMany({ where: { artistId }, data: { status: "HIDDEN", featured: false, coverKey: null, trailerKey: null, purgedAt: now, withdrawnAt: now, withdrawReason: "Artista apagado pela administração" } });
    await tx.artistProfile.update({ where: { id: artistId }, data: { status: "SUSPENDED", founderNumber: null, photoKey: null, rejectionReason: "Apagado pela administração" } });
    await tx.user.update({ where: { id: artist.userId }, data: { disabled: true } });
  });
  for (const k of keys) await del(k).catch(() => {});
  await audit(db, adminId, "ARTIST_ARCHIVED", "ArtistProfile", artistId, { stageName: artist.stageName, series: artist.series.length });
  return { mode: "archived" as const, series: artist.series.length };
}
