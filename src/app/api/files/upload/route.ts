import { NextResponse } from "next/server";
import { verifyLocalToken, writeLocal } from "@/domain/storage";

/** Recebe envios diretos de ficheiros (apenas com STORAGE_DRIVER=local). */
export async function PUT(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  if (!t) return new NextResponse("Forbidden", { status: 403 });
  try {
    const { b, k, op } = await verifyLocalToken(t);
    if (op !== "put") throw new Error();
    await writeLocal(b, k, Buffer.from(await req.arrayBuffer()));
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
}
