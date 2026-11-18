import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { kzLabel } from "@/lib/money";
import { LegalPage, v } from "../LegalPage";
import { db } from "@/lib/db";
import { tierPrices } from "@/domain/coins/service";
import { getInts } from "@/domain/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Acordo do Artista" };

/** Versão para imprimir e assinar (menu do navegador → Imprimir / Guardar como PDF). */
export default async function ArtistAgreement() {
  const n = brand.name;
  const pct = business.artistSharePercent;
  const [prices, c] = await Promise.all([
    tierPrices(db),
    getInts(db, ["seasonDiscountPercent", "tierUpgradeUnlocks", "foundersLimit", "founderMonths", "founderSharePercent", "milestone1Unlocks", "milestone1BonusKz", "milestone2Unlocks", "milestone2BonusKz", "milestone3Unlocks", "milestone3BonusKz", "payoutFirstMinKz", "payoutMinKz", "artistReferralBonusKz", "pendingDays"]),
  ]);
  const firstMin = kzLabel(c.payoutFirstMinKz);
  const min = kzLabel(c.payoutMinKz);
  const blank = "________________________________";

  return (
    <LegalPage title={`Acordo do Artista ${n}`} version={v.artistPolicy}>
      <div className="mt-6 rounded-2xl bg-surface p-5">
        <p className="font-semibold text-accent2">Em resumo</p>
        <ul>
          <li>Publicas as tuas séries na {n} e ganhas <strong>{pct}% de tudo o que o público gastar</strong> nelas (Artistas Fundadores: {c.founderSharePercent}% nos primeiros {c.founderMonths} meses).</li>
          <li>As séries continuam a ser tuas.</li>
          <li>O dinheiro vai para a tua carteira na app; o primeiro levantamento é a partir de {firstMin}.</li>
          <li>Bónus por marcos e por artistas que convidares.</li>
          <li>Entrar é grátis e não há exclusividade. Podes apagar ou retirar as tuas séries.</li>
        </ul>
      </div>

      <h2>Quem assina</h2>
      <p>
        <strong>A plataforma:</strong> {n}, [entidade / responsável], NIF {blank}, com sede em {blank}.
      </p>
      <p>
        <strong>O artista:</strong> Nome completo: {blank}<br />
        Nome artístico: {blank}<br />
        BI n.º: {blank}<br />
        Telefone: {blank} · E-mail: {blank}
      </p>

      <h2>Como dividimos o dinheiro</h2>
      <p>Ganhas quando os teus fãs pagam para ver. De cada episódio desbloqueado (e de cada presente): <strong>{pct}% para ti, {100 - pct}% para a {n}</strong>. A metade da {n} paga os servidores, os vídeos, a divulgação das tuas séries e a equipa. <strong>Artistas Fundadores: {c.founderSharePercent}% para ti nos primeiros {c.founderMonths} meses</strong> (e {100 - c.founderSharePercent}% para a {n}).</p>

      <h2>O que ganhas com a {n}</h2>
      <ul>
        <li><strong>{pct}% de tudo o que o público gastar</strong> nas tuas séries: episódios, temporadas e presentes.</li>
        <li><strong>Artistas Fundadores</strong> (os primeiros {c.foundersLimit}): {c.founderSharePercent}% nos primeiros {c.founderMonths} meses, selo permanente e séries a começar no nível Normal.</li>
        <li><strong>Bónus por marcos</strong> e <strong>bónus “Traz um kamba”</strong> ({kzLabel(c.artistReferralBonusKz)} por artista convidado que faça a primeira venda).</li>
        <li><strong>Tudo à vista</strong> na tua carteira da app: cada ganho aparece logo como pendente e fica disponível {c.pendingDays} dias depois.</li>
        <li><strong>Levantamento</strong> para o teu IBAN ou Multicaixa Express.</li>
        <li><strong>O teu link pessoal</strong> para os fãs, com a contagem de quem veio por ti.</li>
        <li><strong>Ranking e destaque</strong> para os artistas mais vistos e mais apoiados.</li>
        <li><strong>Quanto mais séries e mais público, mais ganhas.</strong></li>
        <li><strong>Não pagas nada para entrar.</strong></li>
      </ul>

      <h2>Como funciona</h2>
      <ol>
        <li>Crias as tuas séries na app e carregas os episódios.</li>
        <li>A {n} revê, publica e promove as séries. Os 3 primeiros episódios são grátis.</li>
        <li>Os fãs desbloqueiam os episódios seguintes com moedas.</li>
        <li>Cada vez que um fã gasta moedas nas tuas séries, os teus {pct}% entram na carteira.</li>
        <li>Pedes o levantamento e recebes na tua conta.</li>
      </ol>

      <h2>O que combinamos</h2>

      <h3 className="mt-5 font-bold">1. Autorização para mostrar as séries</h3>
      <p>O artista autoriza a {n} a alojar, mostrar e promover as séries que entregar, na app e nas redes sociais da {n} (excertos e trailers). A autorização não é exclusiva: o artista pode publicar onde quiser.</p>

      <h3 className="mt-5 font-bold">2. As séries são tuas</h3>
      <p>As séries continuam a ser propriedade do artista. A {n} não fica com os direitos de autor. O artista garante que tem todas as autorizações necessárias (pessoas filmadas, música, locais).</p>

      <h3 className="mt-5 font-bold">3. Episódios grátis e moedas</h3>
      <p>Os 3 primeiros episódios de cada série são grátis, para atrair público. Os seguintes desbloqueiam-se com moedas, ao preço do nível da série, igual para todos os artistas: Entrada ({prices.ENTRY} moedas), Normal ({prices.NORMAL}) ou Premium ({prices.PREMIUM}). As séries começam em Entrada (Fundadores: Normal) e sobem a Normal aos {c.tierUpgradeUnlocks.toLocaleString("pt-AO")} desbloqueios pagos; o nível Premium é atribuído pela {n}. Os fãs podem desbloquear a temporada (todos os episódios que faltam) com {c.seasonDiscountPercent}% de desconto.</p>

      <h3 className="mt-5 font-bold">4. O que o artista ganha</h3>
      <ul>
        <li>{pct}% do valor real das moedas que os fãs gastam a desbloquear episódios e temporadas das suas séries ({c.founderSharePercent}% para Artistas Fundadores nos primeiros {c.founderMonths} meses a contar do registo).</li>
        <li>{pct}% do valor real das moedas gastas nos presentes que receber.</li>
        <li>O valor real de uma moeda é o que o fã pagou por ela, depois das comissões dos serviços de pagamento (quando existirem).</li>
        <li>Anúncios: {pct}% da receita de anúncios de cada mês é dividida pelos artistas, proporcionalmente aos episódios de cada um desbloqueados com anúncio nesse mês (oferta única do fã).</li>
        <li>Episódios desbloqueados com pontos de fã não geram pagamento.</li>
        <li>Se houver planos de membro com acesso ilimitado, as regras de pagamento ao artista são comunicadas antes.</li>
        <li>Bónus por marcos em cada série, pagos uma vez pela {n}: {c.milestone1Unlocks.toLocaleString("pt-AO")} desbloqueios pagos = {kzLabel(c.milestone1BonusKz)}; {c.milestone2Unlocks.toLocaleString("pt-AO")} = {kzLabel(c.milestone2BonusKz)}; {c.milestone3Unlocks.toLocaleString("pt-AO")} = {kzLabel(c.milestone3BonusKz)} e a coroa 👑.</li>
        <li>Bónus “Traz um kamba”: {kzLabel(c.artistReferralBonusKz)} quando um artista convidado faz a primeira venda (uma vez por convidado).</li>
        <li>O artista recebe só do que o público gasta (mais os bónus). Não há valor mínimo garantido.</li>
      </ul>

      <h3 className="mt-5 font-bold">5. Carteira e levantamentos</h3>
      <ul>
        <li>Os ganhos ficam registados na carteira do artista na app: primeiro como pendentes durante {c.pendingDays} dias, depois como disponíveis (pode levantar). Se uma compra for anulada durante esse período, o ganho correspondente é retirado do pendente. Os bónus pagos pela plataforma ficam disponíveis de imediato.</li>
        <li>Primeiro levantamento a partir de {firstMin}; os seguintes a partir de {min}. Para uma conta em nome do artista (IBAN angolano ou Multicaixa Express).</li>
        <li>A {n} tenta pagar em 24 horas; no primeiro levantamento confirma antes o BI e a conta.</li>
        <li>Se uma compra de moedas for anulada, os ganhos que vieram dessas moedas saem da carteira.</li>
      </ul>

      <h3 className="mt-5 font-bold">6. Regras da comunidade</h3>
      <p>Não é permitido conteúdo sexual, ataques ou acusações a pessoas reais, ódio, nem conteúdo roubado. A {n} pode retirar o conteúdo que não cumpra estas regras e explica sempre o motivo.</p>

      <h3 className="mt-5 font-bold">7. Apagar e retirar séries</h3>
      <p>O artista pode apagar as séries em rascunho ou recusadas. Uma série publicada pode ser retirada: sai logo do catálogo; quem já desbloqueou episódios continua a vê-los durante 30 dias e depois os vídeos e a capa são apagados. Os ganhos ficam na carteira e os registos financeiros nunca são apagados.</p>

      <h3 className="mt-5 font-bold">8. Duração e saída</h3>
      <p>Este acordo não tem prazo. O artista pode sair quando quiser; a {n} pode terminá-lo com 15 dias de aviso, por mensagem na app, e-mail ou WhatsApp. Os ganhos acumulados até à saída são pagos ao artista.</p>

      <h3 className="mt-5 font-bold">9. Dados pessoais</h3>
      <p>Os dados do artista são tratados segundo a <Link href="/legal/privacidade" className="text-accent2 underline">Política de Privacidade</Link> e a Lei n.º 22/11.</p>

      <h3 className="mt-5 font-bold">10. Lei e desacordos</h3>
      <p>Aplica-se a lei angolana. Qualquer desacordo resolve-se primeiro a conversar. Se não for possível, é competente o tribunal da comarca de Luanda.</p>

      <p className="mt-6">Os detalhes de cada regra estão na <Link href="/legal/politica-artista" className="text-accent2 underline">Política do Artista</Link>.</p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div><p>Luanda, ____ de ____________ de ______</p><p className="mt-10 border-t border-white/30 pt-1 text-sm">Pela {n}</p></div>
        <div><p>&nbsp;</p><p className="mt-10 border-t border-white/30 pt-1 text-sm">O Artista</p></div>
      </div>
    </LegalPage>
  );
}
