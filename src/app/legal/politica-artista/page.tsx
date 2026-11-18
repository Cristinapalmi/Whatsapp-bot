import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { kzLabel } from "@/lib/money";
import { LegalPage, v } from "../LegalPage";

export const metadata: Metadata = { title: "Política do Artista" };

export default function ArtistPolicy() {
  const n = brand.name;
  const pct = business.artistSharePercent;
  const min = kzLabel(business.minWithdrawalKz);

  return (
    <LegalPage title={`Política do Artista ${n}`} version={v.artistPolicy}>
      <div className="mt-6 rounded-2xl bg-surface p-5">
        <p className="font-semibold text-accent2">Em resumo</p>
        <ul>
          <li>Ganhas <strong>{pct}% de tudo o que o público pagar</strong> pelas tuas séries.</li>
          <li>O dinheiro aparece na tua carteira da app assim que o pagamento é confirmado.</li>
          <li>Levantas para o teu IBAN ou Multicaixa Express a partir de {min}.</li>
          <li>Entrar é grátis. Quanto mais séries e mais público, mais ganhas.</li>
          <li>Só pedimos conteúdo teu, respeitoso, e que os primeiros episódios sejam grátis.</li>
        </ul>
      </div>

      <h2>O que ganhas com a {n}</h2>
      <ul>
        <li><strong>{pct}% de tudo o que o público pagar</strong> pelas tuas séries: episódios desbloqueados e presentes, e ainda uma parte da receita de anúncios.</li>
        <li><strong>Dinheiro na hora:</strong> cada pagamento confirmado aparece logo na tua carteira da app. Vês o saldo a subir.</li>
        <li><strong>Levantamento para o teu IBAN</strong> ou para o teu número Multicaixa Express.</li>
        <li><strong>O teu link pessoal</strong> ({brand.domain}/o-teu-nome) para pores na bio do TikTok e do Instagram. No painel vês quantos fãs vieram por ti.</li>
        <li><strong>Ranking e destaque:</strong> a "Disputa dos artistas" mostra todos os meses quem é mais visto e mais apoiado. Os melhores ganham destaque na página inicial.</li>
        <li><strong>Trailers prontos</strong> para publicares nas redes, com o teu link.</li>
        <li><strong>Quanto mais séries e mais público, mais ganhas.</strong></li>
        <li><strong>Não pagas nada para entrar.</strong></li>
      </ul>

      <h2>Como funciona</h2>
      <ol>
        <li>Regista-te e confirma as 5 caixas.</li>
        <li>A nossa equipa aprova a tua conta.</li>
        <li>Envia a tua série (o link do TikTok ou do Instagram).</li>
        <li>Publicamos. Os fãs veem os primeiros episódios grátis (normalmente 3).</li>
        <li>Para continuar, os fãs desbloqueiam os episódios seguintes com moedas, que compram na app.</li>
        <li>Ganhas {pct}% do valor das moedas gastas nas tuas séries, direto na tua carteira.</li>
        <li>Pedes o levantamento quando quiseres, a partir de {min}.</li>
      </ol>

      <h2>As regras para todos ganharem</h2>

      <h3 className="mt-5 font-bold">1. Mostrar as tuas séries</h3>
      <p>Autorizas a {n} a mostrar as tuas séries na app e a usar excertos, capas, título e o teu nome artístico para as promover (por exemplo, trailers nas redes sociais). Podes continuar a publicar no TikTok, no Instagram ou onde quiseres: não pedimos exclusividade.</p>

      <h3 className="mt-5 font-bold">2. Os primeiros episódios são grátis</h3>
      <p>É assim que se conquista público. Normalmente, os 3 primeiros episódios de cada série são grátis. O último episódio grátis termina em suspense, para os fãs quererem continuar.</p>

      <h3 className="mt-5 font-bold">3. Como calculamos os teus {pct}%</h3>
      <ul>
        <li><strong>Moedas:</strong> os fãs compram moedas na app e usam-nas para desbloquear episódios e oferecer presentes. Cada moeda tem um valor real: o que o fã pagou por ela.</li>
        <li><strong>Episódios:</strong> quando um fã desbloqueia um episódio teu, ganhas {pct}% do valor real das moedas que ele gastou. O preço de cada episódio em moedas é definido pela {n}, igual para todos.</li>
        <li><strong>Presentes:</strong> quando um fã te oferece um presente, ganhas {pct}% do valor real das moedas gastas.</li>
        <li><strong>Comissões:</strong> se um serviço de pagamento cobrar uma comissão, o valor real das moedas é calculado depois dessa comissão. Hoje, com pagamento por transferência, não há comissões.</li>
        <li><strong>Anúncios:</strong> cada fã pode desbloquear um episódio grátis vendo um anúncio (oferta única). Todos os meses, {pct}% da receita de anúncios desse mês é dividida pelos artistas, conforme os episódios de cada um desbloqueados com anúncio nesse mês. Entra na tua carteira depois de o mês terminar.</li>
        <li><strong>Pontos de fã:</strong> os fãs ganham pontos por verem episódios até ao fim e podem trocá-los por episódios. Esses episódios não geram pagamento, porque o fã não gastou dinheiro.</li>
        <li><strong>Planos de membro:</strong> quando houver planos com acesso ilimitado, explicamos-te antes como ganhas com eles.</li>
        <li>Só recebes do que o público gasta. Não há mensalidade nem valor mínimo garantido.</li>
        <li>Se uma compra de moedas for anulada (por exemplo, uma transferência falsa), os ganhos que vieram dessas moedas saem da tua carteira. Se o saldo ficar negativo, os levantamentos ficam em pausa até novos ganhos o compensarem.</li>
      </ul>

      <h3 className="mt-5 font-bold">4. A tua carteira e os levantamentos</h3>
      <ul>
        <li><strong>Saldo disponível:</strong> dinheiro que já recebemos e que podes levantar.</li>
        <li><strong>Saldo pendente:</strong> só existe quando houver pagamentos automáticos. É dinheiro que o serviço de pagamento ainda não nos transferiu. Passa a disponível quando chegar.</li>
        <li>Os teus ganhos entram na carteira no momento em que o fã gasta as moedas nas tuas séries.</li>
        <li><strong>Mínimo para levantar:</strong> {min}.</li>
        <li><strong>Para onde:</strong> uma conta em teu nome (o mesmo nome do registo), por IBAN angolano ou Multicaixa Express.</li>
        <li><strong>Prazo:</strong> pagamos até 10 dias úteis depois do teu pedido. Vês o estado e o comprovativo na app.</li>
        <li>Se houver suspeita de fraude, podemos reter um levantamento enquanto verificamos.</li>
        <li>Os impostos sobre os teus rendimentos são da tua responsabilidade.</li>
      </ul>

      <h3 className="mt-5 font-bold">5. O conteúdo é teu e respeita a comunidade</h3>
      <p>Garantes que a série é tua, e que tens autorização das pessoas que aparecem e da música usada. Não é permitido:</p>
      <ul>
        <li>conteúdo sexual explícito;</li>
        <li>ataques ou acusações a pessoas reais;</li>
        <li>incentivo ao ódio, à violência ou à discriminação;</li>
        <li>conteúdo roubado ou copiado de outros criadores.</li>
      </ul>
      <p>Se uma série não respeitar estas regras, ou depois de uma denúncia fundamentada, podemos retirá-la e explicamos-te porquê. És responsável pelo conteúdo que publicas.</p>

      <h3 className="mt-5 font-bold">6. Quem pode ser artista</h3>
      <p>Tens de ter 18 anos ou mais, dar dados verdadeiros (incluindo o n.º do BI) e ter a conta aprovada pela nossa equipa.</p>

      <h3 className="mt-5 font-bold">7. Se quiseres sair</h3>
      <p>Podes sair quando quiseres. Avisa-nos com 15 dias de antecedência, pela app, por e-mail ou por WhatsApp. Retiramos as tuas séries. Os fãs que já compraram episódios continuam a vê-los durante 30 dias. O teu saldo é pago: acima do mínimo, no processo normal; abaixo do mínimo, quando a conta fecha.</p>

      <p className="mt-8">Para formalizar, lê também o <Link href="/legal/acordo-artista" className="text-accent2 underline">Acordo do Artista</Link>. Dúvidas? Fala connosco: {brand.supportEmail} · WhatsApp {brand.supportWhatsapp}.</p>
    </LegalPage>
  );
}
