import { ImageResponse } from "next/og";
import { brand } from "@config/brand";
import { db } from "@/lib/db";
import { absoluteCoverUrl } from "@/lib/promo";

/** Imagem de pré-visualização (WhatsApp, TikTok, Facebook) de uma série: capa + título + gancho. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await db.series.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { artist: { select: { stageName: true } }, episodes: { where: { published: true, hookText: { not: null } }, orderBy: { number: "asc" }, take: 3 } },
  });
  if (!s) return new Response("Not found", { status: 404 });
  const cover = await absoluteCoverUrl(s.coverKey);
  const hook = s.episodes.find((e) => e.number === s.freeEpisodes)?.hookText ?? s.episodes.at(-1)?.hookText ?? s.synopsis;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#120B06", color: "#FFF4E8", fontFamily: "sans-serif" }}>
        {cover ? <img src={cover} width={420} height={630} style={{ objectFit: "cover" }} alt="" /> : <div style={{ width: 420, background: "#2A1A0E" }} />}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 56 }}>
          <div style={{ fontSize: 28, color: "#FF7A2F", fontWeight: 700 }}>{brand.name}</div>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.05, marginTop: 12 }}>{s.title}</div>
          <div style={{ fontSize: 26, color: "#C9B8A6", marginTop: 8 }}>{`de ${s.artist.stageName}`}</div>
          {hook && <div style={{ fontSize: 32, marginTop: 28, color: "#FFD27A", lineHeight: 1.25 }}>{`“${hook.slice(0, 140)}”`}</div>}
          <div style={{ fontSize: 28, marginTop: 32, background: "#FF7A2F", color: "#1A0E05", padding: "12px 24px", borderRadius: 999, alignSelf: "flex-start", fontWeight: 700 }}>
            {`Os ${s.freeEpisodes} primeiros episódios são grátis`}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
