import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { LegalPage, v } from "../LegalPage";

export const metadata: Metadata = { title: "Acordo do Artista" };

/** Versão para imprimir e assinar (Ctrl+P / Partilhar → Imprimir). */
export default function ArtistAgreement() {
  const n = brand.name;
  const pct = business.artistSharePercent;
  const blank = "________________________________";
  return (
    <LegalPage title="Acordo de Publicação e Partilha de Receitas" version={v.artistPolicy}>
      <p><strong>Entre:</strong></p>
      <p>{n}, [entidade / responsável], NIF {blank}, com sede em {blank} ("Plataforma");</p>
      <p><strong>e</strong></p>
      <p>Nome completo: {blank}<br />Nome artístico: {blank}<br />BI n.º: {blank}<br />Telefone: {blank} · E-mail: {blank}<br />("Artista").</p>

      <h2>Cláusula 1.ª — Objeto e autorização</h2>
      <p>O Artista autoriza a Plataforma a alojar, mostrar e promover as séries que lhe entregar, de forma não exclusiva, na aplicação {n} e nas redes sociais da Plataforma (excertos e trailers).</p>

      <h2>Cláusula 2.ª — Propriedade do conteúdo</h2>
      <p>As séries continuam a ser propriedade do Artista. A Plataforma não adquire direitos de autor. O Artista garante que tem todos os direitos e autorizações necessários (pessoas filmadas, música, locais) e que o conteúdo respeita a Política do Artista.</p>

      <h2>Cláusula 3.ª — Episódios grátis e preço</h2>
      <p>Para cada série, as partes acordam o número de episódios grátis e o preço por episódio (entre {business.episodePriceMinKz} e {business.episodePriceMaxKz} Kz), registados no painel da Plataforma.</p>

      <h2>Cláusula 4.ª — Partilha de receitas ({pct}/{100 - pct})</h2>
      <p>Sobre o valor pago pelo público (depois de eventuais comissões de pagamento), o Artista recebe {pct}% e a Plataforma {100 - pct}%, nos termos da Política do Artista (episódios, passe semanal por tempo de visualização e presentes). A Plataforma não paga valores que não tenha recebido do público. Os episódios desbloqueados com pontos de fã não geram pagamento.</p>

      <h2>Cláusula 5.ª — Pagamento ao Artista</h2>
      <p>Os ganhos ficam registados na carteira do Artista na aplicação. O Artista pode pedir o levantamento a partir de {business.minWithdrawalKz.toLocaleString("pt-AO")} Kz. A Plataforma paga até 10 dias úteis depois do pedido, ou no mínimo uma vez por mês, para a conta indicada pelo Artista em seu nome (IBAN angolano ou Multicaixa Express).</p>

      <h2>Cláusula 6.ª — Retirada de conteúdo</h2>
      <p>A Plataforma pode retirar conteúdo que viole a lei ou a Política do Artista, informando o Artista do motivo.</p>

      <h2>Cláusula 7.ª — Duração e saída</h2>
      <p>Este acordo vigora por tempo indeterminado. Qualquer das partes pode terminá-lo com aviso escrito de 15 dias (mensagem na aplicação, e-mail ou WhatsApp). Os ganhos acumulados até à data de saída são pagos ao Artista.</p>

      <h2>Cláusula 8.ª — Dados pessoais</h2>
      <p>Os dados do Artista são tratados nos termos da Política de Privacidade e da Lei n.º 22/11.</p>

      <h2>Cláusula 9.ª — Lei e litígios</h2>
      <p>Aplica-se a lei angolana. As partes tentam resolver qualquer desacordo amigavelmente. Se não for possível, é competente o tribunal da comarca de Luanda.</p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div><p>Luanda, ____ de ____________ de ______</p><p className="mt-10 border-t border-white/30 pt-1 text-sm">Pela Plataforma</p></div>
        <div><p>&nbsp;</p><p className="mt-10 border-t border-white/30 pt-1 text-sm">O Artista</p></div>
      </div>
    </LegalPage>
  );
}
