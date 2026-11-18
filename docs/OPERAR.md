# O dia a dia da administração

> **Desde a versão com moedas:** os fãs compram **pacotes de moedas** (com comprovativo) e usam as moedas para desbloquear episódios e oferecer presentes. Já não há compra direta de episódios em Kz, e a venda do passe semanal está desligada.

Entra com a conta admin → botão **Admin** (em baixo, no telemóvel). Os números laranja mostram o que está à tua espera.

## Confirmar pagamentos (Admin → Pagamentos)
1. Abre a app do teu banco / Multicaixa Express e vê as entradas.
2. Para cada pedido "A aguardar": compara **valor**, **n.º da operação** e **número de onde pagou** com o comprovativo e com o que entrou na tua conta.
3. Bateu certo → **Confirmar**. Acontece tudo de uma vez: o episódio desbloqueia, o fã é avisado, e 50% vai para a carteira do artista (saldo disponível).
4. Não bateu certo → escreve o motivo → **Rejeitar** (o fã vê o motivo).
5. Erro depois de confirmar (ex.: transferência falsa) → separador "Confirmados" → **Anular**. O episódio volta a ficar bloqueado e o dinheiro sai da carteira do artista.

**Proteções automáticas:** o mesmo comprovativo (ficheiro ou n.º de operação) não pode ser usado duas vezes; cada fã só pode ter 3 pedidos pendentes; fica registado quem confirmou e quando; aparece um aviso se o mesmo número enviou vários pedidos em 24 h.

## Pagar aos artistas (Admin → Levantamentos)
1. O artista pede o levantamento (mínimo 5.000 Kz). O valor fica reservado ("Em processamento").
2. Faz a transferência no teu banco para o IBAN/Multicaixa Express indicado (botão copiar).
3. Carrega o comprovativo → **Marcar como pago**. O artista é avisado.
4. Se não puderes pagar (ex.: IBAN errado) → **Rejeitar** com motivo: o valor volta à carteira do artista.
5. No fim do mês: escolhe o mês → **Exportar CSV** (abre no Excel) para a tua contabilidade.

## Aprovar artistas (Admin → Artistas)
Verifica o perfil do TikTok/Instagram, o nome e o BI. **Aprovar** ou **Rejeitar** com motivo.

## Publicar uma série (Admin → Séries)
1. O artista envia a série ("Em análise"). Combina com ele os episódios grátis e o preço.
2. Abre a série → define preço (50–150 Kz), n.º de episódios grátis, capa (vertical 600×900).
3. **Adicionar episódio** para cada um → carrega o vídeo 360p (e o 480p, se tiveres) → marca "Publicado".
4. No último episódio grátis: marca **Termina em gancho** e escreve o texto do gancho.
5. **Publicar** a série.

## Denúncias (Admin → Denúncias)
Vê a denúncia, abre a série e, se for caso disso, **Retirar** com motivo.

## Verificação de contas (Admin → Resumo)
"Caixa (livro-razão)" deve ser igual ao dinheiro que recebeste menos o que já pagaste aos artistas. Se não bater, há algum pagamento por confirmar ou anular.

## Passe semanal (Admin → Passe semanal)
- O fã paga o passe com comprovativo, como um episódio. Ao confirmares, fica com acesso a todos os episódios durante 7 dias (um segundo passe prolonga).
- Metade vai para a plataforma; a outra metade fica no **fundo da semana**.
- Segunda-feira às 01:30 (hora de Luanda) a app fecha a semana sozinha: divide o fundo pelos artistas conforme o tempo que o público **com passe** viu cada um. Se ninguém viu, passa para a semana seguinte. Também podes carregar em **"Fechar já as semanas terminadas"**.
- Se anulares um passe depois de a semana estar fechada, a parte dos artistas sai do fundo da semana atual (a plataforma nunca paga do bolso, e os artistas não perdem o que já receberam).

## Presentes
O fã escolhe um presente no leitor (Cuca 50 Kz, Muamba 100 Kz, Candonga 200 Kz, Grade 500 Kz) e paga com comprovativo. Confirmas como um pagamento normal: 50% vai logo para a carteira do artista.

## Pontos de fã
- +10 pontos por episódio visto **mesmo** até ao fim (saltar para o fim não conta).
- 100 pontos = 1 episódio grátis (botão no ecrã de pagamento). Não gera pagamento ao artista.
- "Fã n.º 1" = quem tem mais pontos a ver as séries desse artista. Aparece na série, na página do artista e no painel dele.
- Para dar pontos como prémio (ex.: concurso sem pagamento), pede-me uma função de ajuste — os pontos nunca se trocam por dinheiro.

## Link pessoal e "Vieram por ti"
Cada artista tem `dominio/nome`. Quem entra por esse link e cria conta fica associado ao artista (30 dias). O painel do artista mostra visitas, contas criadas e quantos já pagaram.

## Trailers
Ver `docs/TRAILERS.md`. Resumo: `npm run trailer -- <serie>` no teu computador. O artista recebe uma notificação e descarrega o trailer no painel.

## Exportações e extratos (Admin → Exportações)
Escolhe o mês e descarrega (CSV para o Excel):
- **Pagamentos do público:** cada pedido, com a parte do artista e a da plataforma.
- **Ganhos por artista:** saldo no início, episódios, presentes, passe, anulações, levantamentos e saldo no fim.
- **Livro-razão:** débitos e créditos, para o contabilista.
- **Desempenho das séries:** espectadores, minutos, vendas e conversão.
- **Levantamentos** e **Aceitações da Política do Artista** (prova legal das 5 caixas).

Cada artista tem um **extrato mensal** (Carteira → "Extrato mensal") que pode imprimir ou guardar em PDF. Tu também abres o extrato de qualquer artista a partir da página de Exportações.

## Moedas (Admin → Moedas e Admin → Financeiro)
- **Confirmar compras de moedas:** em **Pagamentos**, os pedidos de moedas aparecem como "N moedas". Confirma como qualquer pagamento: as moedas entram logo na carteira do fã, uma única vez.
- **Anular uma compra** (comprovativo falso descoberto depois): em Pagamentos → Confirmados → Anular. A app retira as moedas que sobram, volta a bloquear os episódios desbloqueados com essas moedas e retira ao artista o que ele ganhou com elas.
- **Admin → Moedas:** muda o preço por defeito de um episódio (começa em 20 moedas), os pacotes da Loja (preço, moedas, ativo/inativo, ordem) e os presentes (nome, emoji, preço). Em **Séries → a série** podes pôr um preço diferente só para essa série.
- **Admin → Financeiro:** escolhe as datas e vê as moedas vendidas, gastas e por gastar, a parte dos criadores, a parte da plataforma, as comissões e os levantamentos por aprovar. Também podes descarregar em CSV.
- **Moedas por gastar** ainda não são receita de ninguém: só passam a receita (e a ganho do artista) quando o fã as gasta.
