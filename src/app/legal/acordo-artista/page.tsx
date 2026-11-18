import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@config/brand";
import { business } from "@config/business";
import { kzLabel } from "@/lib/money";
import { LegalPage, v } from "../LegalPage";

export const metadata: Metadata = { title: "Acordo do Artista" };

/** Versão para imprimir e assinar (menu do navegador → Imprimir / Guardar como PDF). */
export default function ArtistAgreement() {
  const n = brand.name;
  const pct = business.artistSharePercent;
  const min = kzLabel(business.minWithdrawalKz);
  const blank = "________________________________";

  return (
    <LegalPage title={`Acordo do Artista ${n}`} version={v.artistPolicy}>
      <div className="mt-6 rounded-2xl bg-surface p-5">
        <p className="font-semibold text-accent2">Em resumo</p>
        <ul>
          <li>Publicas as tuas séries na {n} e ganhas <strong>{pct}% de tudo o que o público pagar</strong> por elas.</li>
          <li>As séries continuam a ser tuas.</li>
          <li>O dinheiro vai para a tua carteira na app e levantas a partir de {min}.</li>
          <li>Entrar é grátis e não há exclusividade.</li>
          <li>Podes sair quando quiseres, com 15 dias de aviso.</li>
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

      <h2>O que ganhas com a {n}</h2>
      <ul>
        <li><strong>{pct}% de tudo o que o público pagar</strong> pelas tuas séries: episódios, passe semanal e presentes.</li>
        <li><strong>Dinheiro na hora</strong> na tua carteira da app, assim que cada pagamento é confirmado.</li>
        <li><strong>Levantamento</strong> para o teu IBAN ou Multicaixa Express.</li>
        <li><strong>O teu link pessoal</strong> para os fãs, com a contagem de quem veio por ti.</li>
        <li><strong>Ranking e destaque</strong> para os artistas mais vistos e mais apoiados.</li>
        <li><strong>Quanto mais séries e mais público, mais ganhas.</strong></li>
        <li><strong>Não pagas nada para entrar.</strong></li>
      </ul>

      <h2>Como funciona</h2>
      <ol>
        <li>Entregas as tuas séries (ou o link onde estão publicadas).</li>
        <li>Combinamos juntos os episódios grátis e o preço de cada episódio ({kzLabel(business.episodePriceMinKz)} a {kzLabel(business.episodePriceMaxKz)}).</li>
        <li>A {n} publica e promove as séries.</li>
        <li>Cada pagamento do público credita os teus {pct}% na carteira.</li>
        <li>Pedes o levantamento e recebes na tua conta.</li>
      </ol>

      <h2>O que combinamos</h2>

      <h3 className="mt-5 font-bold">1. Autorização para mostrar as séries</h3>
      <p>O artista autoriza a {n} a alojar, mostrar e promover as séries que entregar, na app e nas redes sociais da {n} (excertos e trailers). A autorização não é exclusiva: o artista pode publicar onde quiser.</p>

      <h3 className="mt-5 font-bold">2. As séries são tuas</h3>
      <p>As séries continuam a ser propriedade do artista. A {n} não fica com os direitos de autor. O artista garante que tem todas as autorizações necessárias (pessoas filmadas, música, locais).</p>

      <h3 className="mt-5 font-bold">3. Episódios grátis e preço</h3>
      <p>Para cada série, combinamos juntos quantos episódios são grátis, para atrair público, e o preço de cada episódio. Fica registado no painel da {n}.</p>

      <h3 className="mt-5 font-bold">4. O que o artista ganha</h3>
      <ul>
        <li>{pct}% de cada episódio vendido das suas séries.</li>
        <li>{pct}% de cada presente que receber.</li>
        <li>Passe semanal: {pct}% do valor dos passes de cada semana vai para um fundo dos artistas, dividido à segunda-feira conforme o tempo visto com passe. Se ninguém vir, o fundo passa para a semana seguinte.</li>
        <li>Os {pct}% são calculados sobre o valor que fica depois das comissões dos serviços de pagamento (quando existirem).</li>
        <li>Episódios desbloqueados com pontos de fã não geram pagamento.</li>
        <li>O artista recebe só do que o público paga. Não há valor mínimo garantido.</li>
      </ul>

      <h3 className="mt-5 font-bold">5. Carteira e levantamentos</h3>
      <ul>
        <li>Os ganhos ficam registados na carteira do artista na app: saldo disponível (pode levantar) e, com pagamentos automáticos, saldo pendente (à espera de o serviço de pagamento transferir).</li>
        <li>Levantamento a partir de {min}, para uma conta em nome do artista (IBAN angolano ou Multicaixa Express).</li>
        <li>A {n} paga até 10 dias úteis depois do pedido.</li>
        <li>Se um pagamento do público for anulado, a parte correspondente sai da carteira.</li>
      </ul>

      <h3 className="mt-5 font-bold">6. Regras da comunidade</h3>
      <p>Não é permitido conteúdo sexual, ataques ou acusações a pessoas reais, ódio, nem conteúdo roubado. A {n} pode retirar o conteúdo que não cumpra estas regras e explica sempre o motivo.</p>

      <h3 className="mt-5 font-bold">7. Duração e saída</h3>
      <p>Este acordo não tem prazo. Qualquer das partes pode terminá-lo com 15 dias de aviso, por mensagem na app, e-mail ou WhatsApp. Os ganhos acumulados até à saída são pagos ao artista.</p>

      <h3 className="mt-5 font-bold">8. Dados pessoais</h3>
      <p>Os dados do artista são tratados segundo a <Link href="/legal/privacidade" className="text-accent2 underline">Política de Privacidade</Link> e a Lei n.º 22/11.</p>

      <h3 className="mt-5 font-bold">9. Lei e desacordos</h3>
      <p>Aplica-se a lei angolana. Qualquer desacordo resolve-se primeiro a conversar. Se não for possível, é competente o tribunal da comarca de Luanda.</p>

      <p className="mt-6">Os detalhes de cada regra estão na <Link href="/legal/politica-artista" className="text-accent2 underline">Política do Artista</Link>.</p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <div><p>Luanda, ____ de ____________ de ______</p><p className="mt-10 border-t border-white/30 pt-1 text-sm">Pela {n}</p></div>
        <div><p>&nbsp;</p><p className="mt-10 border-t border-white/30 pt-1 text-sm">O Artista</p></div>
      </div>
    </LegalPage>
  );
}
