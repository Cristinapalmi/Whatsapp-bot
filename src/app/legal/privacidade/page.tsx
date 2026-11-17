import type { Metadata } from "next";
import { brand } from "@config/brand";
import { LegalPage, v } from "../LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function Privacy() {
  const n = brand.name;
  return (
    <LegalPage title="Política de Privacidade" version={v.privacy}>
      <p>Esta Política explica que dados pessoais a {n} recolhe, para quê, e quais são os teus direitos, nos termos da Lei n.º 22/11, de 17 de Junho (Lei da Protecção de Dados Pessoais da República de Angola).</p>

      <h2>1. Responsável pelo tratamento</h2>
      <p>[Nome do responsável / entidade, NIF e morada — a preencher]. Contacto: {brand.supportEmail}.</p>

      <h2>2. Que dados recolhemos (apenas os necessários)</h2>
      <ul>
        <li><strong>Público:</strong> nome, número de telefone, palavra-passe (guardada de forma encriptada, nunca em texto legível), data de nascimento (para confirmar a idade mínima).</li>
        <li><strong>Pagamentos:</strong> comprovativo de transferência, número da operação, número de telefone de onde pagaste, valor e data.</li>
        <li><strong>Utilização:</strong> episódios vistos, tempo de visualização, pontos de fã, denúncias enviadas.</li>
        <li><strong>Artistas (além do acima):</strong> nome artístico, nome completo, número do Bilhete de Identidade, e-mail, link das redes sociais, fotografia, dados bancários ou Multicaixa Express para receber os pagamentos.</li>
        <li><strong>Registo de aceitação:</strong> versão do documento aceite, data, hora, endereço IP e tipo de navegador, como prova do consentimento.</li>
      </ul>

      <h2>3. Para que usamos os dados</h2>
      <ul>
        <li>Criar e gerir a tua conta e verificar a idade.</li>
        <li>Confirmar pagamentos, desbloquear episódios e prevenir fraude (por exemplo, comprovativos repetidos).</li>
        <li>Calcular e pagar os ganhos dos artistas.</li>
        <li>Mostrar estatísticas agregadas aos artistas (por exemplo, número de visualizações). Os artistas não veem o teu telefone.</li>
        <li>Cumprir obrigações legais e fiscais.</li>
      </ul>
      <p>Não vendemos os teus dados. Não usamos os teus dados para publicidade de terceiros.</p>

      <h2>4. Fundamento</h2>
      <p>Tratamos os dados com base no teu <strong>consentimento</strong> (dado no registo, de forma expressa), na execução do contrato contigo (prestar o serviço que pediste) e no cumprimento de obrigações legais.</p>

      <h2>5. Com quem partilhamos</h2>
      <ul>
        <li>Prestadores técnicos que alojam a plataforma e os ficheiros (servidores e armazenamento), que só tratam os dados por nossa conta.</li>
        <li>Futuros prestadores de pagamento autorizados, apenas o necessário para processar pagamentos.</li>
        <li>Autoridades, quando a lei o exigir.</li>
      </ul>
      <p>Alguns destes prestadores podem ter servidores fora de Angola. Nesses casos, a transferência é feita com as garantias exigidas pela Lei 22/11 e, quando aplicável, mediante autorização ou comunicação à Agência de Protecção de Dados (APD).</p>

      <h2>6. Durante quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta: enquanto a conta estiver ativa.</li>
        <li>Registos de pagamentos e contabilidade: pelo prazo exigido pela lei fiscal e comercial.</li>
        <li>Comprovativos de pagamento: o tempo necessário para verificação, resolução de reclamações e obrigações legais.</li>
      </ul>

      <h2>7. Os teus direitos</h2>
      <p>Podes pedir para aceder, corrigir ou apagar os teus dados, opor-te a um tratamento ou retirar o consentimento, escrevendo para {brand.supportEmail}. A retirada do consentimento pode impedir a utilização do serviço. Tens também o direito de apresentar reclamação à Agência de Protecção de Dados (APD).</p>

      <h2>8. Segurança</h2>
      <p>Usamos ligações encriptadas (HTTPS), palavras-passe encriptadas, acesso restrito aos comprovativos (só a administração) e links temporários para os ficheiros.</p>

      <h2>9. Menores</h2>
      <p>A plataforma destina-se a maiores de 16 anos. Os artistas têm de ter 18 anos ou mais.</p>

      <h2>10. Alterações</h2>
      <p>Se alterarmos esta Política de forma relevante, pedimos de novo o teu consentimento.</p>

      <p className="mt-8 text-sm text-muted">Nota interna: confirmar com um jurista a obrigação de notificação/autorização prévia junto da APD antes de iniciar o tratamento de dados, em especial do n.º do BI e de eventuais transferências internacionais.</p>
    </LegalPage>
  );
}
