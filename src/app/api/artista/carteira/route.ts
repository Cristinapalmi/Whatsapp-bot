import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin";
import { getArtistWallet, releaseDuePending } from "@/domain/money/ledger";
import { artistMoneySnapshot } from "@/domain/artists/growth";

async function currentArtist() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.artistProfile.findUnique({ where: { userId: user.id } });
}

/** Carteira e conquistas do artista (o painel pergunta de 15 em 15 s — contagem em tempo real). */
export async function GET() {
  const artist = await currentArtist();
  if (!artist) return NextResponse.json({}, { status: 401 });
  await releaseDuePending(db, { artistId: artist.id });
  const [wallet, snap] = await Promise.all([getArtistWallet(db, artist.id), artistMoneySnapshot(db, artist.id)]);
  return NextResponse.json({ ...wallet, snapshot: snap }, { headers: { "Cache-Control": "no-store" } });
}

/** O artista viu as conquistas novas (a animação não se repete). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const artist = await currentArtist();
  if (!artist) return NextResponse.json({}, { status: 401 });
  await db.artistProfile.update({ where: { id: artist.id }, data: { achievementsSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
