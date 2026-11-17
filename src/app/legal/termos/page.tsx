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

      <h2>3. Episódios grátis e pagos</h2>
      <ul>
        <li>O número de episódios grátis é definido para cada série e aparece na página da série.</li>
        <li>Cada episódio pago custa o valor indicado (entre {business.episodePriceMinKz} e {business.episodePriceMaxKz} Kz). Esse valor é mostrado antes do pagamento.</li>
        <li>O episódio desbloqueado fica disponível na tua conta enquanto a série estiver publicada na plataforma.</li>
        <li>Se tiveres um passe semanal ativo, podes ver os episódios pagos durante esse período.</li>
      </ul>

      <h2>4. Como funciona o pagamento (fase atual)</h2>
      <ol>
        <li>Escolhes o episódio e vês as instruções de transferência (Multicaixa Express ou transferência bancária).</li>
        <li>Fazes a transferência do valor exato e envias a fotografia ou captura do comprovativo, o número da operação e o número de onde pagaste.</li>
        <li>O pedido fica "A aguardar confirmação". Depois de verificarmos a entrada do dinheiro, o episódio é desbloqueado e recebes uma notificação.</li>
        <li>Se o pagamento não puder ser confirmado (valor errado, comprovativo ilegível ou repetido), o pedido é rejeitado e explicamos o motivo.</li>
      </ol>
      <p>É proibido enviar comprovativos falsos, alterados ou já usados. Nesses casos a conta pode ser suspensa e os acessos obtidos anulados, sem prejuízo de outras medidas legais.</p>

      <h2>5. Reembolsos</h2>
      <p>Se pagares e o episódio não for desbloqueado por erro nosso, ou se pagares em duplicado, contacta o apoio. Analisamos cada caso e, quando se justificar, devolvemos o valor pelo mesmo meio de pagamento.</p>

      <h2>6. Pontos de fã e prémios</h2>
      <p>Podes ganhar pontos por veres episódios até ao fim. Os pontos <strong>não têm valor em dinheiro</strong>, não podem ser trocados por dinheiro nem transferidos, e só servem para desbloquear episódios ou receber prémios dentro da plataforma. A {n} não organiza apostas, sorteios pagos nem promete ganhar dinheiro a ver vídeos.</p>

      <h2>7. Presentes aos artistas</h2>
      <p>Quando disponíveis, os presentes (Cuca, Muamba, Candonga, Grade) são uma forma voluntária de apoiar um artista. Metade do valor vai para o artista. Os presentes não dão direito a qualquer contrapartida além do agradecimento público, quando existir.</p>

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
