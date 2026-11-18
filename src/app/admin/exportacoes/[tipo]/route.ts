import { db } from "@/lib/db";
import { getAdminForApi } from "@/lib/auth";
import { csvKz, csvResponse, toCsv } from "@/lib/csv";
import { business } from "@config/business";
import { artistsEarningsSummary, coinFinancialReport, ledgerInMonth, paymentsInMonth, periodRange, seriesReport } from "@/domain/reports";
import { monthRange } from "@/domain/ranking";
import { splitRevenue } from "@/domain/money/split";

/** Exportações CSV da administração (abrem no Excel). */
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const user = await getAdminForApi();
  if (!user) return new Response("Proibido", { status: 403 });
  const { tipo } = await params;
  const mes = monthRange(new URL(req.url).searchParams.get("mes") ?? undefined).key;

  switch (tipo) {
    case "financeiro": {
      const u = new URL(req.url).searchParams;
      const mesParam = u.get("mes");
      let de = u.get("de") ?? undefined;
      let ate = u.get("ate") ?? undefined;
      if (!de && !ate && mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
        const [y, m] = mesParam.split("-").map(Number);
        de = `${mesParam}-01`;
        ate = `${mesParam}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
      }
      const range = periodRange(de, ate);
      const r = await coinFinancialReport(db, range.from, range.to);
      const summary: unknown[][] = [
        ["Período", `${range.de} a ${range.ate}`],
        ["Compras de moedas confirmadas", r.sold.purchases],
        ["Moedas vendidas", r.sold.coins],
        ["Valor pago pelos fãs (Kz)", csvKz(r.sold.grossCents)],
        ["Comissões de pagamento (Kz)", csvKz(r.sold.feesCents)],
        ["Valor líquido (Kz)", csvKz(r.sold.netCents)],
        ["Moedas gastas", r.spent.coins],
        ["Valor real gasto (Kz)", csvKz(r.spent.valueCents)],
        ["Parte dos criadores (Kz)", csvKz(r.spent.creatorsCents)],
        ["Parte da plataforma (Kz)", csvKz(r.spent.platformCents)],
        ["Episódios desbloqueados com anúncio", r.ads.unlocks],
        ["Receita de anúncios registada (Kz)", csvKz(r.ads.revenueCents)],
        ["Anúncios: distribuído aos criadores (Kz)", csvKz(r.ads.distributedToCreatorsCents)],
        ["Fundos de anúncios por dividir (Kz)", csvKz(r.ads.poolsNowCents)],
        ["Moedas por gastar (agora)", r.outstanding.coins],
        ["Valor das moedas por gastar (Kz)", csvKz(r.outstanding.valueCents)],
        ["Devido aos criadores (Kz)", csvKz(r.owedToCreatorsCents)],
        ["Levantamentos por aprovar (Kz)", csvKz(r.pendingPayouts.cents)],
        [],
        ["Compras", "data", "fã", "telefone", "moedas", "pago_kz", "comissao_kz", "estado", "confirmado_por"],
        ...r.purchases.map((p) => ["", p.reviewedAt, p.user.name, p.user.phone, p.coins, csvKz(p.amountCents), csvKz(p.feeCents), p.status, p.reviewedBy?.name]),
      ];
      return csvResponse(toCsv(["indicador", "valor"], summary), `financeiro-${range.de}-a-${range.ate}.csv`);
    }
    case "pagamentos": {
      const rows = await paymentsInMonth(db, mes);
      const kind = { EPISODE: "Episódio (Kz)", WEEKLY_PASS: "Passe semanal", GIFT: "Presente (Kz)", COINS: "Moedas" } as const;
      const status = { PENDING: "A aguardar", CONFIRMED: "Confirmado", REJECTED: "Rejeitado", REVERSED: "Anulado" } as const;
      return csvResponse(
        toCsv(
          ["id", "data_pedido", "fa", "telefone_fa", "tipo", "descricao", "artista", "valor_kz", "comissao_kz", "parte_artista_kz", "parte_plataforma_kz", "metodo", "pagou_de", "n_operacao", "estado", "motivo", "tratado_por", "tratado_em"],
          rows.map((p) => {
            const s = splitRevenue(p.amountCents, p.feeCents, business.artistSharePercent);
            const desc = p.kind === "EPISODE" && p.episode ? `${p.episode.series.title} — Ep. ${p.episode.number}` : p.kind === "GIFT" ? business.gifts.find((g) => g.id === p.giftType)?.label ?? "" : "Passe";
            return [
              p.id, p.createdAt, p.user.name, p.user.phone, kind[p.kind], desc, p.artist?.stageName ?? (p.kind === "WEEKLY_PASS" ? "(fundo do passe)" : ""),
              csvKz(p.amountCents), csvKz(p.feeCents), csvKz(s.artistCents), csvKz(s.platformCents),
              p.method, p.payerPhone, p.transactionRef, status[p.status], p.rejectionReason, p.reviewedBy?.name, p.reviewedAt,
            ];
          }),
        ),
        `pagamentos-${mes}.csv`,
      );
    }
    case "ganhos-artistas": {
      const rows = await artistsEarningsSummary(db, mes);
      return csvResponse(
        toCsv(
          ["artista", "nome_completo", "bi", "saldo_inicio_kz", "episodios_kz", "presentes_kz", "passe_kz", "anuncios_kz", "anulacoes_kz", "total_ganho_kz", "levantamentos_pedidos_kz", "levantamentos_devolvidos_kz", "levantamentos_pagos_kz", "saldo_fim_kz"],
          rows.map((r) => [
            r.artist.stageName, r.artist.fullName, r.artist.biNumber, csvKz(r.openingCents),
            csvKz(r.totals.EPISODE), csvKz(r.totals.GIFT), csvKz(r.totals.PASS), csvKz(r.totals.ADS), csvKz(r.totals.REVERSAL), csvKz(r.earnedCents),
            csvKz(-r.totals.PAYOUT_REQUEST), csvKz(r.totals.PAYOUT_RETURNED), csvKz(r.payoutsPaid.cents), csvKz(r.closingCents),
          ]),
        ),
        `ganhos-artistas-${mes}.csv`,
      );
    }
    case "livro-razao": {
      const rows = await ledgerInMonth(db, mes);
      return csvResponse(
        toCsv(
          ["data", "lancamento", "tipo", "descricao", "conta", "nome_conta", "debito_kz", "credito_kz", "registado_por"],
          rows.map((l) => [
            l.createdAt, l.entryId, l.entry.kind, l.entry.description, l.account.code, l.account.name,
            l.amountCents > 0 ? csvKz(l.amountCents) : "", l.amountCents < 0 ? csvKz(-l.amountCents) : "", l.entry.createdBy?.name,
          ]),
        ),
        `livro-razao-${mes}.csv`,
      );
    }
    case "series": {
      const rows = await seriesReport(db, mes);
      return csvResponse(
        toCsv(
          ["serie", "artista", "estado", "espectadores", "minutos_vistos", "episodios_vistos_ate_ao_fim", "episodios_vendidos", "vendas_kz", "compradores", "conversao_pct"],
          rows.map((r) => [r.title, r.artist, r.status, r.viewers, r.minutes, r.completions, r.salesCount, csvKz(r.salesCents), r.buyers, r.conversionPct.toFixed(1).replace(".", ",")]),
        ),
        `series-${mes}.csv`,
      );
    }
    case "consentimentos": {
      const rows = await db.consent.findMany({
        where: { user: { role: "ARTIST" } },
        orderBy: [{ userId: "asc" }, { acceptedAt: "asc" }],
        include: { user: { select: { name: true, phone: true, artistProfile: { select: { stageName: true } } } } },
      });
      return csvResponse(
        toCsv(
          ["artista", "nome", "telefone", "documento", "versao", "aceite_em", "ip", "navegador"],
          rows.map((c) => [c.user.artistProfile?.stageName, c.user.name, c.user.phone, c.document, c.version, c.acceptedAt, c.ip, c.userAgent]),
        ),
        "aceitacoes-politica-artistas.csv",
      );
    }
    default:
      return new Response(`Tipo desconhecido. Disponíveis: financeiro, pagamentos, ganhos-artistas, livro-razao, series, consentimentos.`, { status: 404 });
  }
}
