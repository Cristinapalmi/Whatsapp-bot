import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { makeUser, resetTestDb } from "./helpers";
import {
  addEpisode, approveReview, createSeriesDraft, deleteEpisode, deleteSeries, moveEpisode, purgeWithdrawnSeries, rejectReview, reviewChecklist, reviewCount, submitForReview,
  updateEpisode, updateSeriesDetails, withdrawSeries,
} from "@/domain/series-workflow";
import { sniff } from "@/lib/filetype";

let db: PrismaClient;
beforeAll(async () => {
  db = await resetTestDb();
});
afterAll(async () => {
  await db.$disconnect();
});

async function newArtist() {
  const u = await makeUser(db, "ARTIST");
  const a = await db.artistProfile.create({
    data: { userId: u.id, stageName: `Art ${u.phone}`, fullName: "Nome Completo", biNumber: "000000000LA000", email: "a@b.ao", socialUrl: "https://tiktok.com/@x", category: "DRAMA", slug: `art${u.phone.slice(-6)}` },
  });
  return { user: u, artist: a };
}
const details = { title: "Minha Série", synopsis: "Uma história de família em Luanda, cheia de segredos.", category: "DRAMA" as const, plannedEpisodes: 5 };

/** Série pronta a enviar: capa, sinopse, 3 episódios com vídeo e gancho no 3.º */
async function readySeries(artistId: string) {
  const s = await createSeriesDraft(db, artistId, { ...details, coverKey: "covers/c.jpg" });
  const eps = [];
  for (let i = 1; i <= 3; i++) {
    const e = await addEpisode(db, artistId, s.id, `Ep ${i}`);
    await db.episode.update({ where: { id: e.id }, data: { videoKey: `videos/${s.id}/${i}.mp4`, ...(i === 3 ? { endsWithHook: true, hookText: "E agora?" } : {}) } });
    eps.push(e);
  }
  return { s, eps };
}

describe("O artista faz tudo, a admin só verifica e publica", () => {
  it("artista novo fica logo ativo", async () => {
    const { artist } = await newArtist();
    expect(artist.status).toBe("APPROVED");
  });

  it("lista de verificação: capa, sinopse, 3 episódios com vídeo e gancho no 3.º", async () => {
    const { artist } = await newArtist();
    const s = await createSeriesDraft(db, artist.id, { ...details, synopsis: "curta" });
    const e1 = await addEpisode(db, artist.id, s.id, "Início");
    expect([e1.number]).toEqual([1]);
    const ck = reviewChecklist(s, [e1]);
    expect(ck.filter((c) => !c.ok)).toHaveLength(4);
    await expect(submitForReview(db, artist.id, s.id)).rejects.toThrow(/capa carregada; sinopse escrita/);
  });

  it("rascunho → enviada → publicada; só aparece depois de aprovada; episódios novos também são revistos", async () => {
    const admin = await makeUser(db, "ADMIN");
    const { artist, user } = await newArtist();
    const { s } = await readySeries(artist.id);
    const extra = await addEpisode(db, artist.id, s.id, "Sem vídeo ainda");
    const r = await submitForReview(db, artist.id, s.id);
    expect(r).toEqual({ episodes: 3, missingVideo: 1 });
    expect((await db.series.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("IN_REVIEW");
    expect(await reviewCount(db)).toBe(1);
    await expect(updateSeriesDetails(db, artist.id, s.id, details)).rejects.toThrow(/enviada ou publicada/);

    await approveReview(db, admin.id, s.id);
    const after = await db.series.findUniqueOrThrow({ where: { id: s.id }, include: { episodes: { orderBy: { number: "asc" } } } });
    expect(after.status).toBe("PUBLISHED");
    expect(after.episodes.slice(0, 3).every((e) => e.published)).toBe(true);
    expect(after.episodes[3]).toMatchObject({ status: "DRAFT", published: false });
    expect(await db.notification.count({ where: { userId: user.id, title: "A tua série foi publicada!" } })).toBe(1);

    await db.episode.update({ where: { id: extra.id }, data: { videoKey: "videos/y.mp4" } });
    await submitForReview(db, artist.id, s.id);
    expect((await db.episode.findUniqueOrThrow({ where: { id: extra.id } })).status).toBe("IN_REVIEW");
    await approveReview(db, admin.id, s.id);
    expect((await db.episode.findUniqueOrThrow({ where: { id: extra.id } })).published).toBe(true);
  });

  it("recusar exige motivo, o artista é avisado e pode corrigir e reenviar", async () => {
    const admin = await makeUser(db, "ADMIN");
    const { artist, user } = await newArtist();
    const { s, eps } = await readySeries(artist.id);
    await submitForReview(db, artist.id, s.id);
    await expect(rejectReview(db, admin.id, s.id, "")).rejects.toThrow(/motivo/);
    await rejectReview(db, admin.id, s.id, "O som está muito baixo");
    expect(await db.series.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({ status: "REJECTED", rejectionReason: "O som está muito baixo" });
    expect(await db.notification.count({ where: { userId: user.id, title: "Revisão: precisa de correções" } })).toBe(1);
    await updateEpisode(db, artist.id, eps[0].id, { title: "Ep corrigido", endsWithHook: false, hookText: null });
    expect((await db.episode.findUniqueOrThrow({ where: { id: eps[0].id } })).status).toBe("DRAFT");
    await submitForReview(db, artist.id, s.id);
    expect((await db.series.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("IN_REVIEW");
  });

  it("apagar só séries em rascunho/recusadas; retirar séries publicadas e limpar os ficheiros depois de 30 dias", async () => {
    const admin = await makeUser(db, "ADMIN");
    const { artist } = await newArtist();
    const draft = await readySeries(artist.id);
    const del = await deleteSeries(db, artist.id, draft.s.id);
    expect(del.keys).toContain("covers/c.jpg");
    expect(await db.series.findUnique({ where: { id: draft.s.id } })).toBeNull();

    const pub = await readySeries(artist.id);
    await submitForReview(db, artist.id, pub.s.id);
    await approveReview(db, admin.id, pub.s.id);
    await expect(deleteSeries(db, artist.id, pub.s.id)).rejects.toThrow(/retirada/);
    await withdrawSeries(db, artist.id, pub.s.id, "Vou refazer");
    const w = await db.series.findUniqueOrThrow({ where: { id: pub.s.id } });
    expect(w.status).toBe("HIDDEN");
    expect(w.withdrawnAt).not.toBeNull();
    const deleted: string[] = [];
    expect(await purgeWithdrawnSeries(db, new Date(), async (k) => deleted.push(k))).toBe(0); // ainda dentro dos 30 dias
    expect(await purgeWithdrawnSeries(db, new Date(Date.now() + 31 * 86400000), async (k) => deleted.push(k))).toBe(1);
    expect(deleted).toContain("covers/c.jpg");
    const purged = await db.series.findUniqueOrThrow({ where: { id: pub.s.id }, include: { episodes: true } });
    expect(purged.coverKey).toBeNull();
    expect(purged.episodes.every((e) => !e.videoKey)).toBe(true);
  });

  it("reordenar e apagar só episódios por publicar; renumera", async () => {
    const { artist } = await newArtist();
    const s = await createSeriesDraft(db, artist.id, details);
    const a = await addEpisode(db, artist.id, s.id, "A");
    const b = await addEpisode(db, artist.id, s.id, "B");
    const c = await addEpisode(db, artist.id, s.id, "C");
    await moveEpisode(db, artist.id, c.id, "up");
    const order = (await db.episode.findMany({ where: { seriesId: s.id }, orderBy: { number: "asc" } })).map((x) => x.title);
    expect(order).toEqual(["A", "C", "B"]);
    await deleteEpisode(db, artist.id, a.id);
    const after = await db.episode.findMany({ where: { seriesId: s.id }, orderBy: { number: "asc" } });
    expect(after.map((x) => [x.number, x.title])).toEqual([[1, "C"], [2, "B"]]);
    await db.episode.update({ where: { id: b.id }, data: { status: "PUBLISHED", published: true } });
    await expect(deleteEpisode(db, artist.id, b.id)).rejects.toThrow(/por publicar/);
    await expect(moveEpisode(db, artist.id, c.id, "down")).rejects.toThrow(/já enviado ou publicado/);
  });

  it("um artista não mexe nas séries de outro", async () => {
    const one = await newArtist();
    const two = await newArtist();
    const s = await createSeriesDraft(db, one.artist.id, details);
    await expect(addEpisode(db, two.artist.id, s.id, "intruso")).rejects.toThrow(/não encontrada/);
    await expect(submitForReview(db, two.artist.id, s.id)).rejects.toThrow(/não encontrada/);
  });
});

describe("Tipo real dos ficheiros", () => {
  it("reconhece pelas assinaturas, não pelo nome", () => {
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniff(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(sniff(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]))).toBe("mp4");
    expect(sniff(new TextEncoder().encode("WEBVTT\n\n00:00"))).toBe("vtt");
    expect(sniff(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });
});
