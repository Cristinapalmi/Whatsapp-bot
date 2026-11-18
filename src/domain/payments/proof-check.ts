import type { PrismaClient } from "@prisma/client";
import { notify } from "../notify";

/**
 * VERIFICAÇÃO DE COMPROVATIVOS — a app NUNCA confirma nem recusa sozinha.
 * Só marca "🚩 Suspeito" com os motivos, para o admin olhar com mais atenção.
 * Sinais: valor lido ≠ pacote; n.º de operação escrito não aparece; data com mais de 24 h;
 * metadados com sinais de edição; conta nova com vários pedidos.
 * (Comprovativo/n.º repetido e lista negra já são recusados no envio.)
 */

export type ProofFacts = { text: string | null; software: string | null; created: Date | null; modified: Date | null };

const EDITORS = /photoshop|picsart|snapseed|canva|gimp|lightroom|pixlr|fotor|polarr|photo ?editor|inshot|meitu|vsco/i;

/** Lê o texto (OCR, português) e os metadados da imagem. PDFs: só metadados não; devolve vazio. */
export async function readProofFacts(bytes: Buffer, type: string): Promise<ProofFacts> {
  if (type === "pdf") return { text: null, software: null, created: null, modified: null };
  const facts: ProofFacts = { text: null, software: null, created: null, modified: null };
  try {
    const exifr = (await import("exifr")).default;
    const meta = await exifr.parse(bytes, { tiff: true, exif: true, xmp: true, ihdr: false, iptc: false }).catch(() => null);
    if (meta) {
      facts.software = [meta.Software, meta.CreatorTool, meta.ProcessingSoftware].filter(Boolean).join(" ") || null;
      facts.created = meta.DateTimeOriginal instanceof Date ? meta.DateTimeOriginal : null;
      facts.modified = meta.ModifyDate instanceof Date ? meta.ModifyDate : null;
    }
  } catch {}
  try {
    const { createWorker } = await import("tesseract.js");
    const path = await import("node:path");
    const langPath = path.join(process.cwd(), "node_modules/@tesseract.js-data/por/4.0.0_best_int");
    const worker = await createWorker("por", 1, { langPath, cacheMethod: "none", gzip: true });
    try {
      const r = await worker.recognize(bytes);
      facts.text = r.data.text?.slice(0, 4000) ?? null;
    } finally {
      await worker.terminate();
    }
  } catch (e) {
    console.warn("[comprovativo] OCR não correu:", e instanceof Error ? e.message : e);
  }
  return facts;
}

/** Valores em Kz encontrados no texto (ex.: "1.000,00 Kz", "1 000", "Montante: 1000"). */
export function amountsInText(text: string): number[] {
  const out = new Set<number>();
  const re = /(\d{1,3}(?:[.\s ]\d{3})+|\d+)(?:,(\d{2}))?(?:\.(\d{2}))?\s*(?:kz|aoa|kwanzas?)?/gi;
  const lines = text.split(/\n/);
  for (const line of lines) {
    const moneyLine = /kz|aoa|kwanza|montante|valor|quantia|importância|total/i.test(line);
    if (!moneyLine) continue;
    for (const m of line.matchAll(re)) {
      const n = Number(m[1].replace(/[.\s ]/g, ""));
      if (Number.isFinite(n) && n >= 50 && n <= 10_000_000) out.add(n);
    }
  }
  return [...out];
}

/** Sequências que parecem um n.º de operação (6+ dígitos ou letras+dígitos). */
export function refsInText(text: string): string[] {
  return [...new Set((text.toUpperCase().match(/[A-Z0-9]{6,}/g) ?? []).filter((x) => /\d{4,}/.test(x)))];
}

/** Datas no texto (dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd). */
export function datesInText(text: string): Date[] {
  const out: Date[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 23, 59)); // fim do dia (sem hora = benefício da dúvida)
    if (!Number.isNaN(d.getTime()) && +m[2] <= 12) out.push(d);
  }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 23, 59)));
  return out;
}

export type ProofContext = { expectedKz: number; typedRef: string; submittedAt: Date; accountCreatedAt: Date; requestsLast24h: number };

/** Motivos para marcar como suspeito (vazio = nada estranho). */
export function proofReasons(f: ProofFacts, c: ProofContext): string[] {
  const reasons: string[] = [];
  if (f.text) {
    const amounts = amountsInText(f.text);
    if (amounts.length > 0 && !amounts.includes(c.expectedKz))
      reasons.push(`O valor lido no comprovativo (${amounts.slice(0, 3).map((a) => `${a.toLocaleString("pt-AO")} Kz`).join(", ")}) não bate com o pacote (${c.expectedKz.toLocaleString("pt-AO")} Kz).`);
    const typed = c.typedRef.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const refs = refsInText(f.text);
    const flat = f.text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (refs.length > 0 && typed.length >= 4 && !flat.includes(typed))
      reasons.push("O n.º de operação escrito pelo fã não aparece no comprovativo.");
    const dates = datesInText(f.text);
    if (dates.length > 0) {
      const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
      if (c.submittedAt.getTime() - latest.getTime() > 24 * 3600_000) reasons.push(`Comprovativo com mais de 24 h (data lida: ${latest.toISOString().slice(0, 10).split("-").reverse().join("/")}).`);
      if (latest.getTime() - c.submittedAt.getTime() > 2 * 24 * 3600_000) reasons.push("A data do comprovativo está no futuro.");
    }
  }
  if (f.software && EDITORS.test(f.software)) reasons.push(`A imagem tem sinais de edição (programa: ${f.software.slice(0, 40)}).`);
  if (f.created && f.modified && f.modified.getTime() - f.created.getTime() > 60_000) reasons.push("A imagem foi alterada depois de tirada (metadados).");
  if (c.submittedAt.getTime() - c.accountCreatedAt.getTime() < 24 * 3600_000 && c.requestsLast24h >= 2)
    reasons.push(`Conta nova (menos de 24 h) com ${c.requestsLast24h} pedidos.`);
  return reasons;
}

/** Verifica um pedido e guarda o resultado. Chamado depois do envio (não atrasa o fã). */
export async function checkPaymentProof(
  db: PrismaClient,
  paymentId: string,
  bytes: Buffer,
  type: string,
  read: (b: Buffer, t: string) => Promise<ProofFacts> = readProofFacts,
) {
  const p = await db.paymentRequest.findUnique({ where: { id: paymentId }, include: { user: { select: { createdAt: true } } } });
  if (!p || p.proofCheckedAt) return null;
  const facts = await read(bytes, type);
  const requestsLast24h = await db.paymentRequest.count({ where: { userId: p.userId, createdAt: { gte: new Date(p.createdAt.getTime() - 24 * 3600_000), lte: p.createdAt } } });
  const reasons = proofReasons(facts, {
    expectedKz: Math.round(p.amountCents / 100),
    typedRef: p.transactionRef ?? "",
    submittedAt: p.createdAt,
    accountCreatedAt: p.user.createdAt,
    requestsLast24h,
  });
  await db.paymentRequest.update({
    where: { id: p.id },
    data: { suspicious: reasons.length > 0, suspicionReasons: reasons, ocrText: facts.text, proofCheckedAt: new Date() },
  });
  if (reasons.length > 0) {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const a of admins) await notify(db, a.id, "🚩 Comprovativo suspeito", reasons[0], "/admin/pagamentos");
  }
  return reasons;
}

/** Plano B: se a verificação depois do envio não correu, faz-se ao abrir a página de pagamentos. */
export async function checkUncheckedProofs(db: PrismaClient, getUrl: (key: string) => Promise<string>, max = 2) {
  const list = await db.paymentRequest.findMany({
    where: { status: "PENDING", proofCheckedAt: null, proofKey: { not: null }, createdAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    orderBy: { createdAt: "asc" },
    take: max,
  });
  for (const p of list) {
    try {
      const url = await getUrl(p.proofKey!);
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      await checkPaymentProof(db, p.id, bytes, p.proofKey!.endsWith(".pdf") ? "pdf" : "img");
    } catch (e) {
      console.warn("[comprovativo] plano B falhou:", e instanceof Error ? e.message : e);
    }
  }
}
