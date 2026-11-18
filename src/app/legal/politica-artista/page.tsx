import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { kzLabel } from "@/lib/money";
import { db } from "@/lib/db";
import { tierPrices } from "@/domain/coins/service";
import { getInts } from "@/domain/settings";
import { LegalPage, v } from "../LegalPage";

export const metadata: Metadata = { title: "Política do Artista" };
export const dynamic = "force-dynamic";

export default async function ArtistPolicy() {
  const n = brand.name;
  const pct = business.artistSharePercent;
  const [prices, c] = await Promise.all([
    tierPrices(db),
    getInts(db, [
      "tierUpgradeUnlocks", "seasonDiscountPercent", "foundersLimit", "founderMonths", "founderSharePercent",
      "milestone1Unlocks", "milestone1BonusKz", "milestone2Unlocks", "milestone2BonusKz", "milestone3Unlocks", "milestone3BonusKz",
      "payoutFirstMinKz", "payoutMinKz", "artistReferralBonusKz", "pendingDays",
    ]),
  ]);
  const firstMin = kzLabel(c.payoutFirstMinKz);
  const min = kzLabel(c.payoutMinKz);

  return (
    <LegalPage title={`Política do Artista ${n}`} version={v.artistPolicy}>
      <div className="mt-6 rounded-2xl bg-surface p-5">
        <p className="font-semibold text-accent2">Em resumo</p>
        <ul>
          <li>Ganhas <strong>{pct}% de tudo o que o público gastar</strong> nas tuas séries — e os <strong>Artistas Fundadores ganham {c.founderSharePercent}%</strong> nos primeiros {c.founderMonths} meses.</li>
          <li>Cada desbloqueio aparece logo na tua carteira como <strong>pendente</strong> e passa sozinho a <strong>disponível</strong> {c.pendingDays} dias depois.</li>
          <li>O teu <strong>primeiro levantamento é a partir de {firstMin}</strong>, para o teu IBAN ou Multicaixa Express. Tentamos pagar em 24 horas.</li>
          <li>Bónus quando as tuas séries chegam a marcos, e bónus por cada artista que convidares.</li>
          <li>Entrar é grátis. Tu crias, carregas e geres as tuas séries; nós revemos e publicamos.</li>
        </ul>
      </div>

      <h2>Como dividimos o dinheiro</h2>
      <p>Ganhas quando os teus fãs pagam para ver. De cada episódio desbloqueado (e de cada presente): <strong>{pct}% para ti, {100 - pct}% para a {n}</strong>. A metade da {n} paga os servidores, os vídeos, a divulgação das tuas séries e a equipa. <strong>Artistas Fundadores: {c.founderSharePercent}% para ti nos primeiros {c.founderMonths} meses</strong> (e {100 - c.founderSharePercent}% para a {n}).</p>

      <h2>O que ganhas com a {n}</h2>
      <ul>
        <li><strong>{pct}% de tudo o que o público gastar</strong> nas tuas séries: episódios desbloqueados, temporadas, presentes, e ainda uma parte da receita de anúncios.</li>
        <li><strong>Artistas Fundadores:</strong> os primeiros {c.foundersLimit} artistas registados ganham <strong>{c.founderSharePercent}%</strong> durante os primeiros {c.founderMonths} meses a contar do registo (depois, {pct}%), ficam com o selo “Artista Fundador” para sempre, e as séries deles começam logo no nível Normal.</li>
        <li><strong>Bónus por marcos</strong>, em cada série, pagos uma única vez e por cima do que já ganhas:
          <ul>
            <li>{c.milestone1Unlocks.toLocaleString("pt-AO")} desbloqueios pagos: bónus de {kzLabel(c.milestone1BonusKz)};</li>
            <li>{c.milestone2Unlocks.toLocaleString("pt-AO")} desbloqueios pagos: bónus de {kzLabel(c.milestone2BonusKz)};</li>
            <li>{c.milestone3Unlocks.toLocaleString("pt-AO")} desbloqueios pagos: bónus de {kzLabel(c.milestone3BonusKz)} e a coroa 👑 na série.</li>
          </ul>
        </li>
        <li><strong>Traz um kamba:</strong> convida outro artista com o teu link. Quando ele fizer a primeira venda, ganhas {kzLabel(c.artistReferralBonusKz)} (uma vez por artista convidado).</li>
        <li><strong>Acompanhas tudo ao vivo:</strong> cada desbloqueio aparece logo na tua carteira (pendente durante {c.pendingDays} dias, depois disponível). Recebes um resumo por dia (“Hoje ganhaste…”), e avisos no primeiro fã, nos marcos e nos bónus.</li>
        <li><strong>O teu perfil e o teu link pessoal</strong> ({brand.domain}/o-teu-nome), com seguidores: quem te segue é avisado quando publicas séries ou episódios novos.</li>
        <li><strong>Kit de promoção</strong> pronto quando a série é publicada: imagem para o estado e stories, com o link e o código QR, e o texto para colar.</li>
        <li><strong>Não pagas nada para entrar.</strong></li>
      </ul>

      <h2>Como funciona</h2>
      <ol>
        <li>Regista-te e confirma as 5 caixas. A tua conta fica ativa logo.</li>
        <li>Cria a série (título, sinopse, capa, classificação, etiquetas) e carrega os episódios: cada episódio é um vídeo vertical.</li>
        <li>Envia para revisão quando tiveres a capa, a sinopse e pelo menos 3 episódios, com o 3.º a terminar em suspense (gancho).</li>
        <li>A nossa equipa revê e publica (ou explica o que corrigir).</li>
        <li>Os fãs veem os 3 primeiros episódios grátis e desbloqueiam os seguintes com moedas.</li>
        <li>Ganhas a tua parte do valor das moedas gastas, direto na tua carteira.</li>
        <li>Pedes o levantamento quando quiseres.</li>
      </ol>

      <h2>As regras para todos ganharem</h2>

      <h3 className="mt-5 font-bold">1. Mostrar as tuas séries</h3>
      <p>Autorizas a {n} a mostrar as tuas séries na app e a usar excertos, capas, título e o teu nome artístico para as promover (por exemplo, imagens de pré-visualização e trailers nas redes sociais). Não pedimos exclusividade.</p>

      <h3 className="mt-5 font-bold">2. Os primeiros episódios são grátis</h3>
      <p>Os 3 primeiros episódios de cada série são sempre grátis. O 3.º termina em suspense, para os fãs quererem continuar.</p>

      <h3 className="mt-5 font-bold">3. Níveis de preço e temporada</h3>
      <ul>
        <li>Cada série tem um nível de preço por episódio, igual para todos: <strong>Entrada</strong> ({prices.ENTRY} moedas), <strong>Normal</strong> ({prices.NORMAL} moedas) ou <strong>Premium</strong> ({prices.PREMIUM} moedas).</li>
        <li>As séries novas começam em Entrada (as dos Artistas Fundadores em Normal) e <strong>sobem sozinhas a Normal</strong> quando chegam a {c.tierUpgradeUnlocks.toLocaleString("pt-AO")} desbloqueios pagos — avisamos-te. O nível Premium é atribuído pela {n} às séries de maior sucesso.</li>
        <li>Os fãs podem desbloquear de uma vez todos os episódios que faltam (<strong>temporada</strong>), com {c.seasonDiscountPercent}% de desconto. Ganhas a tua parte do valor real que o fã pagou.</li>
      </ul>

      <h3 className="mt-5 font-bold">4. Como calculamos o que ganhas</h3>
      <ul>
        <li><strong>Moedas:</strong> cada moeda tem um valor real — o que o fã pagou por ela (as moedas de bónus, incluindo a oferta de boas-vindas, entram nessa conta).</li>
        <li><strong>Episódios, temporadas e presentes:</strong> ganhas {pct}% (Fundadores: {c.founderSharePercent}% nos primeiros {c.founderMonths} meses) do valor real das moedas gastas.</li>
        <li><strong>Anúncios:</strong> todos os meses, {pct}% da receita de anúncios é dividida pelos artistas, conforme os episódios de cada um desbloqueados com anúncio nesse mês.</li>
        <li><strong>Pontos de fã:</strong> episódios desbloqueados com pontos não geram pagamento, porque o fã não gastou dinheiro.</li>
        <li><strong>Bónus</strong> (marcos e convites) são pagos pela {n}, à parte, e ficam registados na tua carteira.</li>
        <li>Se uma compra de moedas for anulada (por exemplo, uma transferência falsa), os ganhos que vieram dessas moedas saem da tua carteira. Se o saldo ficar negativo, os levantamentos ficam em pausa até novos ganhos o compensarem.</li>
      </ul>

      <h3 className="mt-5 font-bold">5. A tua carteira e os levantamentos</h3>
      <ul>
        <li><strong>Primeiro levantamento:</strong> a partir de {firstMin}. <strong>Seguintes:</strong> a partir de {min}.</li>
        <li><strong>Pendente:</strong> os ganhos ficam {c.pendingDays} dias em pendente e depois passam sozinhos a disponível (a data aparece na carteira). Se uma compra for anulada nesse período, o ganho correspondente sai do pendente. Os bónus da plataforma ficam disponíveis logo.</li>
        <li><strong>Para onde:</strong> uma conta em teu nome, por IBAN angolano ou Multicaixa Express.</li>
        <li><strong>Prazo:</strong> tentamos pagar em 24 horas. No primeiro levantamento confirmamos o teu BI e a conta antes de pagar.</li>
        <li>Se houver suspeita de fraude, podemos reter um levantamento enquanto verificamos.</li>
        <li>Os impostos sobre os teus rendimentos são da tua responsabilidade.</li>
      </ul>

      <h3 className="mt-5 font-bold">6. Apagar e retirar séries</h3>
      <ul>
        <li>Uma série em <strong>rascunho ou recusada</strong> podes apagá-la quando quiseres, com os vídeos.</li>
        <li>Uma série <strong>publicada</strong> podes retirá-la da {n}: sai logo do catálogo, da pesquisa, do ranking e das sugestões. Quem já desbloqueou episódios continua a vê-los durante 30 dias; depois, os vídeos e a capa são apagados.</li>
        <li>Os episódios publicados só saem retirando a série.</li>
        <li>O dinheiro que já ganhaste continua na tua carteira, e os registos financeiros nunca são apagados.</li>
      </ul>

      <h3 className="mt-5 font-bold">7. O conteúdo é teu e respeita a comunidade</h3>
      <p>Garantes que a série é tua, e que tens autorização das pessoas que aparecem e da música usada. Usa só imagens tuas na capa, sem marcas de outras apps. Não é permitido:</p>
      <ul>
        <li>conteúdo sexual explícito;</li>
        <li>ataques ou acusações a pessoas reais;</li>
        <li>incentivo ao ódio, à violência ou à discriminação;</li>
        <li>conteúdo roubado ou copiado de outros criadores.</li>
      </ul>
      <p>Se uma série não respeitar estas regras, ou depois de uma denúncia fundamentada, podemos retirá-la e explicamos-te porquê. És responsável pelo conteúdo que publicas.</p>

      <h3 className="mt-5 font-bold">8. Quem pode ser artista</h3>
      <p>Tens de ter 18 anos ou mais e dar dados verdadeiros (incluindo o n.º do BI).</p>

      <h3 className="mt-5 font-bold">9. Se quiseres sair</h3>
      <p>Podes sair quando quiseres: retira as tuas séries e avisa-nos pela app, por e-mail ou por WhatsApp. O teu saldo é pago: acima do mínimo, no processo normal; abaixo do mínimo, quando a conta fecha.</p>

      <p className="mt-8">Para formalizar, lê também o <Link href="/legal/acordo-artista" className="text-accent2 underline">Acordo do Artista</Link>. Dúvidas? Fala connosco: {brand.supportEmail} · WhatsApp {brand.supportWhatsapp}.</p>
    </LegalPage>
  );
}
