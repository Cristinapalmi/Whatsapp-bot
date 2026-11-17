import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Exporta em CSV (abre no Excel) os levantamentos de um mês. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new NextResponse("Proibido", { status: 403 });
  const mes = new URL(req.url).searchParams.get("mes") ?? "";
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return new NextResponse("Mês inválido (AAAA-MM)", { status: 400 });
  const from = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const to = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  const rows = await db.payoutRequest.findMany({
    where: { requestedAt: { gte: from, lt: to } },
    orderBy: { requestedAt: "asc" },
    include: { artist: { select: { stageName: true, fullName: true, biNumber: true } }, processedBy: { select: { name: true } } },
  });
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Evita "injeção de fórmulas" no Excel
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ["id", "pedido_em", "artista", "nome_completo", "bi", "valor_kz", "estado", "metodo", "titular", "banco", "iban", "multicaixa_express", "tratado_em", "tratado_por", "nota"];
  const lines = rows.map((r) => [
    r.id, r.requestedAt.toISOString(), r.artist.stageName, r.artist.fullName, r.artist.biNumber, (r.amountCents / 100).toFixed(2),
    r.status, r.method, r.holderName, r.bankName, r.iban, r.mcxPhone, r.processedAt?.toISOString(), r.processedBy?.name, r.adminNote,
  ].map(esc).join(";"));
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="levantamentos-${mes}.csv"` },
  });
}
