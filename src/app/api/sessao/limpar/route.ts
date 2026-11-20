import { NextResponse } from "next/server";

/** Sessão expirada ou conta que já não existe: apaga a sessão e volta ao Início, sem mensagem de erro. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const para = u.searchParams.get("para");
  const dest = para && para.startsWith("/") && !para.startsWith("//") ? para : "/";
  const res = NextResponse.redirect(new URL(dest, u.origin));
  res.cookies.delete("sid");
  return res;
}
