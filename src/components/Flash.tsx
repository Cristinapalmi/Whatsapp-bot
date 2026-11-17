const MESSAGES: Record<string, string> = {
  confirmado: "Pagamento confirmado: episódio desbloqueado, fã notificado e 50% creditado ao artista.",
  rejeitado: "Rejeitado. A pessoa foi avisada com o motivo.",
  anulado: "Pagamento anulado e lançamento inverso registado.",
  pago: "Levantamento marcado como pago. O artista foi notificado.",
};

/** Mensagem de sucesso no topo da página depois de uma ação do admin. */
export function Flash({ code }: { code?: string }) {
  if (!code || !MESSAGES[code]) return null;
  return <p role="status" className="mb-4 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">{MESSAGES[code]}</p>;
}
