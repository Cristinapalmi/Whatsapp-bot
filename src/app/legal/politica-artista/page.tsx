import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { LegalPage, v } from "../LegalPage";

export const metadata: Metadata = { title: "Política do Artista" };

export default function ArtistPolicy() {
  const n = brand.name;
  const pct = business.artistSharePercent;
  return (
    <LegalPage title="Política do Artista" version={v.artistPolicy}>
      <p>Esta Política aplica-se a quem publica séries na {n} ("Artista"). No registo, o Artista aceita cada um dos 5 pontos abaixo numa caixa separada e obrigatória. Guardamos a versão, a data e a hora de cada aceitação.</p>
      <p>Requisitos: ter 18 anos ou mais, indicar dados verdadeiros (incluindo o n.º do Bilhete de Identidade) e ser aprovado pela administração. A conta só fica ativa depois da aprovação.</p>

      <h2>1. Autorização para mostrar as séries</h2>
      <p>O Artista autoriza a {n} a alojar, mostrar e transmitir as suas séries na plataforma, e a usar excertos, capas, título e nome artístico para as promover (por exemplo, trailers nas redes sociais). Esta autorização não é exclusiva: o Artista pode continuar a publicar no TikTok, Instagram ou onde quiser.</p>

      <h2>2. Episódios grátis</h2>
      <p>O Artista aceita que os primeiros episódios de cada série sejam gratuitos para o público. O número de episódios grátis é acordado com o Artista para cada série, antes da publicação. Normalmente, o último episódio grátis termina num momento de suspense ("gancho").</p>

      <h2>3. Divisão das receitas: {pct}% / {100 - pct}%</h2>
      <ul>
        <li>O dinheiro vem apenas do público que paga. A {n} nunca paga ao Artista do próprio bolso nem garante um mínimo.</li>
        <li><strong>Episódios:</strong> o Artista recebe {pct}% de cada episódio vendido da sua série; a plataforma fica com {100 - pct}%.</li>
        <li><strong>Comissões:</strong> se um prestador de pagamento cobrar comissão, a divisão é feita sobre o valor depois dessa comissão. Na fase manual atual não há comissão.</li>
        <li><strong>Passe semanal:</strong> {pct}% do valor dos passes vendidos numa semana é dividido entre os artistas na proporção do tempo que o público com passe viu as séries de cada um. É creditado no fecho semanal. Se numa semana não houver visualizações, o valor passa para a semana seguinte. Os cêntimos de arredondamento ficam para a plataforma.</li>
        <li><strong>Presentes</strong> (Cuca 50 Kz, Muamba 100 Kz, Candonga 200 Kz, Grade 500 Kz): o Artista recebe {pct}% de cada presente.</li>
        <li><strong>Pontos de fã:</strong> episódios desbloqueados com pontos não geram pagamento ao Artista, porque o público não pagou dinheiro.</li>
        <li>Quando um pagamento é confirmado, a parte do Artista aparece na carteira imediatamente.</li>
        <li>Se um pagamento for anulado (por exemplo, transferência falsa ou reembolso), a parte correspondente é retirada da carteira. Se o saldo ficar negativo, não é possível levantar até ganhos futuros o compensarem.</li>
      </ul>

      <h2>4. Regras do conteúdo</h2>
      <p>O Artista garante que:</p>
      <ul>
        <li>o conteúdo é seu, ou que tem autorização de todas as pessoas que aparecem e dos donos da música e de outros materiais usados;</li>
        <li>não tem conteúdo sexual explícito;</li>
        <li>não tem ataques, acusações ou difamação de pessoas reais identificáveis;</li>
        <li>não incita ao ódio, à violência ou à discriminação;</li>
        <li>não é conteúdo roubado ou copiado de outros criadores.</li>
      </ul>
      <p>A {n} pode recusar ou retirar séries que violem estas regras, ou depois de uma denúncia fundamentada. O Artista é responsável perante terceiros pelo conteúdo que publica.</p>

      <h2>5. Regras de levantamento</h2>
      <ul>
        <li><strong>Saldo disponível:</strong> dinheiro já recebido pela plataforma, que o Artista pode levantar.</li>
        <li><strong>Saldo pendente:</strong> usado apenas quando houver pagamentos automáticos, enquanto o prestador ainda não transferiu o dinheiro. Passa a disponível quando o dinheiro chega.</li>
        <li><strong>Mínimo:</strong> {business.minWithdrawalKz.toLocaleString("pt-AO")} Kz por levantamento.</li>
        <li><strong>Conta para receber:</strong> o titular tem de ser o próprio Artista, com o mesmo nome do registo (IBAN angolano ou Multicaixa Express).</li>
        <li><strong>Prazo:</strong> os pedidos são processados até 10 dias úteis depois do pedido. Na fase atual, a transferência é feita manualmente pela administração, que junta o comprovativo.</li>
        <li>A plataforma pode reter um levantamento enquanto investiga suspeitas de fraude.</li>
        <li>O Artista é responsável pelas suas obrigações fiscais sobre os rendimentos recebidos.</li>
      </ul>

      <h2>Saída</h2>
      <p>O Artista pode pedir a retirada das suas séries a qualquer momento, com aviso de 15 dias. Os episódios já comprados pelo público podem continuar disponíveis para esses compradores durante 30 dias. O saldo disponível acima do mínimo é pago no processo normal; abaixo do mínimo, é pago no encerramento da conta.</p>
    </LegalPage>
  );
}
