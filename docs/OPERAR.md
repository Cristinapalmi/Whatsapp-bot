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

## Séries de exemplo (demo)
- No primeiro deploy depois desta versão, a app apaga sozinha (uma única vez) as séries, episódios, artistas e contas de teste do demo. Contas reais, compras e contabilidade não são tocadas.
- O resultado aparece no topo de **Admin → Resumo**: "Séries de exemplo apagadas…".
- Se alguma conta real estiver ligada ao demo (por exemplo, um fã gastou moedas num episódio de exemplo), nada é apagado. O Resumo mostra a lista e um botão para apagar devolvendo as moedas/pontos a esses fãs.
- O deploy online nunca mais cria séries de exemplo, mesmo com `SEED_DEMO=true`.

## Leitor (estilo Reels)
- O episódio abre em ecrã inteiro, na vertical. Desliza para cima → episódio seguinte; para baixo → anterior; toque → pausa.
- Botões à direita: Presentes, Guardar na lista, Episódios, Partilhar, Legendas, Poupar dados.
- No fim de cada episódio passa sozinho ao seguinte; num episódio bloqueado aparece o cartão de desbloqueio (moedas, anúncio único, comprar moedas).
- Vídeos verticais (9:16) ocupam o ecrã todo; vídeos horizontais aparecem ao centro com a capa desfocada por trás.

## O artista faz tudo, a admin só verifica e publica
1. O artista regista-se em `/artista/registar` e fica **logo ativo**.
2. No painel: **Nova série** (título, sinopse, categoria, capa vertical, episódios previstos) → adiciona episódios → carrega cada vídeo (MP4 vertical, até 50 MB) → opcional: legendas, gancho, trailer → **Enviar para revisão**.
3. A admin vê em **Admin → Revisão** (com contador): capa, sinopse e cada episódio com leitor → **Aprovar e publicar** ou **Recusar** (com motivo). O artista recebe a notificação.
4. Episódios novos numa série já publicada também passam pela Revisão.
5. O preço em moedas e o número de episódios grátis são da plataforma (Admin → Moedas / Admin → Séries).
6. **Primeiro levantamento:** em Admin → Levantamentos aparece "verifica o artista": confirma o BI e que a conta está em nome dele, e só depois podes marcar como pago.
7. A admin continua a poder suspender artistas, editar ou retirar séries, escolher o destaque e a sugestão ao abrir a app.

## Novidades (Etapas 1–6)

**O admin só revê.** Em Séries → (série) vês capa, dados e episódios com leitor. Botões: Aprovar e publicar, Recusar (motivo obrigatório), Retirar do catálogo, Destaque na página inicial, Sugerir ao abrir a app, Marcar como Premium. Quem cria e edita é o artista.

**Regras que podes mudar sem programador:**
- Admin → Moedas: preços por nível (Entrada 10 / Normal 20 / Premium 30), desbloqueios para subir a Normal (100), desconto da temporada (20%), oferta de boas-vindas (pacote de 1.000 Kz, +50 moedas, 24 h).
- Admin → Artistas → "Regras dos artistas": vagas de Fundador (20), meses e parte do Fundador, marcos e bónus, mínimos de levantamento (1.º 1.000 Kz, seguintes 5.000 Kz), bónus "Traz um kamba" (2.000 Kz), comparação com o TikTok.
- Admin → Convites → "Regras dos fãs": pontos dos convites, horas de espera, limite por mês, Embaixador, pontos de presença.

**Pagamentos:** os suspeitos aparecem primeiro, com "🚩 Suspeito" e os motivos (valor lido, n.º de operação, data, edição da imagem, conta nova). A app nunca confirma nem recusa sozinha: **confirma sempre no Multicaixa Express/banco** (valor, hora e n.º de operação). "Rejeitar e bloquear" põe a pessoa na lista negra (não pode enviar mais comprovativos); "Desbloquear" desfaz.

**Convites suspeitos (Admin → Convites):** convites de fãs com sinais de batota (mesmo aparelho, muitas contas da mesma ligação). "Anular pontos" retira os pontos; "Bloquear" impede a pessoa de ganhar pontos de convites e de presença.

**Tarefa diária automática** (Vercel, 22:40 de Luanda, precisa de `CRON_SECRET`): resumo do dia para os artistas, validação dos convites e limpeza de séries retiradas há mais de 30 dias.
