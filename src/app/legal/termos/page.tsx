import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { LegalPage, v } from "../LegalPage";

export const metadata: Metadata = { title: "Termos de Utilização" };

export default function Terms() {
  const n = brand.name;
  return (
    <LegalPage title="Termos de Utilização do Público" version={v.terms}>
      <h2>1. O que é a {n}</h2>
      <p>A {n} é uma plataforma digital onde podes ver minisséries angolanas criadas por artistas e criadores de conteúdo. Os primeiros episódios de cada série são gratuitos; os seguintes podem ser desbloqueados mediante pagamento.</p>

      <h2>2. Quem pode usar</h2>
      <ul>
        <li>Tens de ter pelo menos {business.minAgePublic} anos para criar conta.</li>
        <li>Os pagamentos são da responsabilidade do titular da conta e do meio de pagamento usado.</li>
        <li>Os dados que indicas (nome, telefone, data de nascimento) têm de ser verdadeiros.</li>
        <li>A conta é pessoal. Não partilhes a tua palavra-passe.</li>
      </ul>

      <h2>3. Episódios grátis e moedas</h2>
      <ul>
        <li>Os primeiros episódios de cada série são grátis (normalmente 3). O número aparece na página da série.</li>
        <li>Os episódios seguintes desbloqueiam-se com <strong>moedas</strong>. O preço em moedas aparece antes de desbloqueares.</li>
        <li>Um episódio desbloqueado fica teu para sempre, enquanto a série estiver publicada na plataforma.</li>
        <li>Também podes oferecer <strong>presentes</strong> aos artistas, pagos com moedas.</li>
      </ul>

      <h2>4. As moedas</h2>
      <ul>
        <li>As moedas compram-se na Loja, em pacotes com o preço em Kz indicado. Os pacotes maiores podem incluir moedas de bónus.</li>
        <li>As moedas só servem para desbloquear episódios e oferecer presentes dentro da {n}.</li>
        <li><strong>As moedas não são reembolsáveis, não se transferem para outras pessoas e nunca se convertem em dinheiro.</strong></li>
        <li>Por agora, as moedas não têm prazo de validade. Se isso mudar, avisamos com antecedência.</li>
        <li>Quando usas moedas numa série, uma parte do valor vai para o artista que a criou.</li>
      </ul>

      <h2>5. Como pagar as moedas (fase atual)</h2>
      <ol>
        <li>Escolhes um pacote na Loja e vês as instruções de transferência (Multicaixa Express ou transferência bancária).</li>
        <li>Fazes a transferência do valor exato e envias a fotografia ou captura do comprovativo, o número da operação e o número de onde pagaste.</li>
        <li>O pedido fica "A aguardar confirmação". Depois de verificarmos a entrada do dinheiro, as moedas entram na tua carteira e recebes uma notificação.</li>
        <li>Se o pagamento não puder ser confirmado (valor errado, comprovativo ilegível ou repetido), o pedido é rejeitado e explicamos o motivo.</li>
      </ol>
      <p>É proibido enviar comprovativos falsos, alterados ou já usados. Se descobrirmos um pagamento falso depois de o confirmarmos, retiramos as moedas dessa compra e voltamos a bloquear os episódios desbloqueados com elas. A conta pode ser suspensa, sem prejuízo de outras medidas legais.</p>
      <p>Se pagares e as moedas não entrarem por erro nosso, ou se pagares em duplicado, contacta o apoio: analisamos cada caso e corrigimos.</p>

      <h2>6. Pontos de fã e prémios</h2>
      <p>Podes ganhar pontos por veres episódios até ao fim e trocá-los por episódios. Os pontos são diferentes das moedas: <strong>não têm valor em dinheiro</strong>, não podem ser trocados por dinheiro nem transferidos. A {n} não organiza apostas, sorteios pagos nem promete ganhar dinheiro a ver vídeos.</p>

      <h2>7. Planos de membro</h2>
      <p>Os planos de membro (semanal, mensal e anual) ainda não estão disponíveis. Quando estiverem, as condições e os preços serão mostrados antes de qualquer pagamento.</p>

      <h2>8. Regras de conduta</h2>
      <ul>
        <li>É proibido gravar, copiar, descarregar ou republicar os episódios fora da plataforma.</li>
        <li>É proibido tentar contornar o bloqueio de episódios ou usar programas automáticos.</li>
        <li>Podes denunciar conteúdos que violem as regras através do botão "Denunciar".</li>
      </ul>

      <h2>9. Conteúdo</h2>
      <p>As séries pertencem aos respetivos artistas, que autorizaram a {n} a mostrá-las. Os artistas são responsáveis pelo conteúdo que criam. A {n} pode retirar qualquer conteúdo que viole a lei ou estas regras.</p>

      <h2>10. Suspensão da conta</h2>
      <p>Podemos suspender ou encerrar contas que violem estes Termos. Podes pedir o encerramento da tua conta a qualquer momento através do apoio.</p>

      <h2>11. Responsabilidade</h2>
      <p>Fazemos o possível para manter a plataforma disponível, mas não garantimos funcionamento sem interrupções (por exemplo, por falhas de internet ou manutenção).</p>

      <h2>12. Alterações</h2>
      <p>Podemos alterar estes Termos. Quando a alteração for importante, pedimos-te que aceites a nova versão.</p>

      <h2>13. Lei aplicável e contactos</h2>
      <p>Estes Termos regem-se pela lei da República de Angola. Contactos: {brand.supportEmail} · WhatsApp {brand.supportWhatsapp}.</p>
    </LegalPage>
  );
}
