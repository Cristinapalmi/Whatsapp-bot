import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * - Guarda o código de convite de um amigo (?amigo=CODIGO) durante 30 dias.
 * - Dá a cada navegador um identificador aleatório (só para detetar contas repetidas nos convites).
 * - Apaga cookies de sessão expirados ou inválidos.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  // Sessão expirada ou inválida: apaga-se sem mensagem (a página mostra-se como sem sessão)
  const sid = req.cookies.get("sid")?.value;
  const secret = process.env.SESSION_SECRET;
  if (sid && secret && secret.length >= 32) {
    try {
      await jwtVerify(sid, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    } catch {
      res.cookies.delete("sid");
    }
  }
  const amigo = req.nextUrl.searchParams.get("amigo");
  const secure = req.nextUrl.protocol === "https:";
  if (amigo && /^[A-Z0-9]{4,16}$/i.test(amigo) && !req.cookies.get("amigo"))
    res.cookies.set("amigo", amigo.toUpperCase(), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 30 * 86400 });
  if (!req.cookies.get("did"))
    res.cookies.set("did", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 2 * 365 * 86400 });
  return res;
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon|icons/|manifest|sw\\.js|.*\\.(?:png|jpg|svg|webp|mp4|vtt|js|css)$).*)"],
};
