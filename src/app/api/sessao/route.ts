import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

/** Há sessão? (Se o cookie existe mas a sessão já não é válida, apaga-o.) */
export async function GET() {
  const s = await getSession();
  const res = NextResponse.json({ loggedIn: !!s }, { headers: { "Cache-Control": "no-store" } });
  if (!s && (await cookies()).get("sid")) res.cookies.delete("sid");
  return res;
}
