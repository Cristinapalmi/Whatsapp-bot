import { isSameOrigin } from "@/lib/origin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { dayLuanda } from "@/lib/dates";

/**
 * Regista uma visita ao link pessoal de um artista ("Vieram por ti").
 * - Guarda no navegador quem trouxe a pessoa (30 dias); se ela criar conta, fica associada ao artista.
 * - Conta no máximo uma visita por navegador, por artista, por dia.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const { slug } = (await req.json().catch(() => ({}))) as { slug?: string };
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  const artist = await db.artistProfile.findFirst({ where: { slug, status: "APPROVED" }, select: { id: true } });
  if (!artist) return NextResponse.json({ ok: false }, { status: 404 });

  const jar = await cookies();
  const day = dayLuanda();
  const dayStr = day.toISOString().slice(0, 10);
  const seenKey = `refv_${artist.id}`;
  if (jar.get(seenKey)?.value !== dayStr) {
    await db.referralVisit.upsert({
      where: { artistId_day: { artistId: artist.id, day } },
      create: { artistId: artist.id, day, visits: 1 },
      update: { visits: { increment: 1 } },
    });
    jar.set(seenKey, dayStr, { maxAge: 2 * 86400, httpOnly: true, sameSite: "lax", path: "/" });
  }
  // O primeiro artista a trazer a pessoa fica com o crédito
  if (!jar.get("ref")) jar.set("ref", artist.id, { maxAge: 30 * 86400, httpOnly: true, sameSite: "lax", path: "/" });
  return NextResponse.json({ ok: true });
}
