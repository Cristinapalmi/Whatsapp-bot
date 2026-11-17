/**
 * CSV compatível com o Excel em português: separador ";" e vírgula decimal.
 * Protege contra "injeção de fórmulas" (células que começam por = + - @).
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '""';
  const s = v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 19) : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d ,.]*$/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers.map(csvCell).join(";"), ...rows.map((r) => r.map(csvCell).join(";"))].join("\r\n");
}

/** Cêntimos → "1234,50" (número que o Excel PT reconhece). */
export const csvKz = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
