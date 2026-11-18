/**
 * Proteção CSRF para rotas POST: o pedido tem de vir do próprio site.
 * (As "server actions" do Next.js já fazem esta verificação sozinhas.)
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
