import { db } from "@/lib/db";
import { csvKz, csvResponse, toCsv } from "@/lib/csv";
import { resolveStatementArtist } from "@/lib/statement-access";
import { STATEMENT_LABELS, artistStatement } from "@/domain/reports";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const artist = await resolveStatementArtist(url.searchParams.get("artista"));
  if (!artist) return new Response("Proibido", { status: 403 });
  const st = await artistStatement(db, artist.id, url.searchParams.get("mes") ?? undefined);
  const rows: unknown[][] = [
    [st.month, "Saldo no início", "", csvKz(st.openingCents)],
    ...st.movements.map((m) => [m.date, STATEMENT_LABELS[m.type], m.description, csvKz(m.amountCents)]),
    [st.month, "Saldo no fim", "", csvKz(st.closingCents)],
  ];
  return csvResponse(toCsv(["data", "tipo", "descricao", "valor_kz"], rows), `extrato-${artist.slug}-${st.month}.csv`);
}
