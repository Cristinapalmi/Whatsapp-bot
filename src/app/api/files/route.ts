import { NextResponse } from "next/server";
import { readLocal, verifyLocalToken } from "@/domain/storage";

/** Serve ficheiros guardados localmente (apenas com STORAGE_DRIVER=local), com link assinado. */
const TYPES: Record<string, string> = {
  mp4: "video/mp4", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", pdf: "application/pdf", vtt: "text/vtt", svg: "image/svg+xml", csv: "text/csv",
};

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  if (!t) return new NextResponse("Not found", { status: 404 });
  try {
    const { b, k, op, dl } = await verifyLocalToken(t);
    if (op !== "get") throw new Error();
    const data = await readLocal(b, k);
    const ext = k.split(".").pop()?.toLowerCase() ?? "";
    const type = TYPES[ext] ?? "application/octet-stream";
    // Suporte a "Range" para os vídeos poderem avançar/recuar
    const range = req.headers.get("range");
    if (range && type.startsWith("video/")) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m?.[1] ? Number(m[1]) : 0;
      const end = m?.[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
      return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${data.length}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
        },
      });
    }
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        ...(dl ? { "Content-Disposition": `attachment; filename="${dl.replace(/"/g, "")}"` } : {}),
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
