import { ImageResponse } from "next/og";
import { brand, siteUrl } from "@config/brand";
import { db } from "@/lib/db";
import { absoluteCoverUrl, qrDataUrl } from "@/lib/promo";

/**
 * KIT DE PROMOÇÃO: imagem vertical (1080×1920) para o estado do WhatsApp e stories:
 * capa + título + "O resto está na KONTA" + link + código QR. Só para séries publicadas.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.series.findFirst({ where: { id, status: "PUBLISHED" }, include: { artist: { select: { stageName: true } } } });
  if (!s) return new Response("Not found", { status: 404 });
  const link = `${siteUrl()}/serie/${s.slug}`;
  const [cover, qr] = await Promise.all([absoluteCoverUrl(s.coverKey), qrDataUrl(link)]);
  const download = new URL(req.url).searchParams.get("descarregar") === "1";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#120B06", color: "#FFF4E8", fontFamily: "sans-serif" }}>
        {cover ? <img src={cover} width={1080} height={1240} style={{ objectFit: "cover" }} alt="" /> : <div style={{ width: 1080, height: 1240, background: "#2A1A0E" }} />}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 60px", width: "100%" }}>
          <div style={{ fontSize: 76, fontWeight: 800, textAlign: "center", lineHeight: 1.05 }}>{s.title}</div>
          <div style={{ fontSize: 34, color: "#C9B8A6", marginTop: 8 }}>{`de ${s.artist.stageName}`}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 36 }}>
            <img src={qr} width={260} height={260} style={{ borderRadius: 24 }} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 50, fontWeight: 800, color: "#FF7A2F" }}>{`O resto está na ${brand.name}`}</div>
              <div style={{ fontSize: 30, marginTop: 12, color: "#FFD27A" }}>{`${brand.domain}/serie/${s.slug}`.slice(0, 48)}</div>
              <div style={{ fontSize: 28, marginTop: 12, color: "#C9B8A6" }}>{`${s.freeEpisodes} episódios grátis`}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "public, max-age=600",
        ...(download ? { "Content-Disposition": `attachment; filename="kit-${s.slug}.png"` } : {}),
      },
    },
  );
}
