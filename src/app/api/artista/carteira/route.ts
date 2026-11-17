import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getArtistWallet } from "@/domain/money/ledger";

/** Saldo atual da carteira (usado para a contagem "em tempo real" no painel). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({}, { status: 401 });
  const artist = await db.artistProfile.findUnique({ where: { userId: user.id } });
  if (!artist) return NextResponse.json({}, { status: 404 });
  return NextResponse.json(await getArtistWallet(db, artist.id), { headers: { "Cache-Control": "no-store" } });
}
