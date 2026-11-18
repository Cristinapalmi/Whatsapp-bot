# Como o dinheiro é registado

## Regra de ouro
Nenhum saldo é "escrito" diretamente. Cada movimento é um **lançamento** com linhas que **somam zero** (dupla entrada). O saldo de cada carteira é sempre a soma dos lançamentos. Assim há sempre histórico, e é impossível "inventar" dinheiro.

Os valores são guardados em **cêntimos** (100 Kz = 10 000), para não haver erros de arredondamento (75 Kz ÷ 2 = 37,50 Kz certos).

## Contas
| Conta | O que é |
|---|---|
| Caixa da plataforma | dinheiro que entrou nas tuas contas |
| Receita da plataforma | os teus 50% |
| Carteira do artista (disponível) | o que o artista pode levantar |
| Carteira do artista (pendente) | só na fase automática, até o prestador liquidar |
| Levantamentos em processamento | dinheiro reservado de levantamentos pedidos |
| Fundo do passe (semana) | Fase 2: parte dos artistas no passe, até ao fecho semanal |

## Moedas (versão atual)
| Movimento | Lançamento |
|---|---|
| Fã compra 100 moedas por 1.000 Kz (confirmado no admin) | Caixa +1.000 · **Moedas por gastar** −1.000 |
| Fã gasta 20 moedas num episódio (valor real 200 Kz) | Moedas por gastar +200 · Carteira do artista −100 · Receita da plataforma −100 |
| Fã oferece um Mimo (10 moedas = 100 Kz) | Moedas por gastar +100 · Carteira do artista −50 · Receita −50 |
| Compra anulada | os gastos feitos com essas moedas são invertidos, e depois a compra também |

- Cada compra é um **lote** que guarda o valor real das moedas (valor pago − comissões). Nos pacotes com bónus, cada moeda vale menos (ex.: 1.200 moedas por 10.000 Kz ≈ 8,33 Kz por moeda).
- Gasta-se primeiro as moedas mais antigas. As últimas moedas de cada lote levam o resto dos cêntimos, para a soma dar sempre exatamente o valor pago.
- Ninguém consegue gastar as mesmas moedas duas vezes, nem com dois cliques ou dois separadores abertos ao mesmo tempo.

## Exemplos
**Fã paga 100 Kz por um episódio, tu confirmas:**
Caixa +100 · Receita −50 · Carteira do artista −50 (crédito = o artista ganha 50).

**Artista pede levantamento de 5.000 Kz:** Carteira disponível +5.000 · Em processamento −5.000.
**Marcas "Pago":** Em processamento +5.000 · Caixa −5.000.
**Rejeitas o levantamento:** volta de "Em processamento" para a carteira disponível.
**Anulas um pagamento:** lançamento exatamente inverso ao da confirmação.

**Fã compra o passe (300 Kz):** Caixa +300 · Receita −150 · Fundo do passe da semana −150.
**Fecho semanal:** Fundo +150 · Carteiras dos artistas −(parte de cada um, pelo tempo visto com passe) · Receita −(cêntimos de arredondamento). Sem visualizações: Fundo desta semana +150 · Fundo da semana seguinte −150.
**Presente Cuca (50 Kz):** Caixa +50 · Receita −25 · Carteira do artista −25.
**Pontos de fã:** não aparecem no livro-razão (tabela à parte, sem valor monetário).

## Regras testadas automaticamente (`npm test`)
- divisão 50/50, incluindo valores ímpares e comissões do prestador;
- passe semanal dividido por tempo de visualização (com restos e semanas sem visualizações);
- presentes (Cuca, Muamba, Candonga, Grade) com 50% para o artista;
- episódios desbloqueados com pontos não geram pagamento;
- não se confirma o mesmo pedido duas vezes (nem em simultâneo);
- comprovativo repetido e limite de pedidos pendentes;
- rejeição não mexe em dinheiro; anulação repõe tudo;
- levantamentos nunca ultrapassam o saldo (nem com dois pedidos em simultâneo), respeitam o mínimo, e a rejeição devolve o valor;
- semanas do passe em hora de Luanda (incluindo passagem de ano);
- passe: 50/50, prolongamento, acesso, fecho semanal proporcional, sem repetir, por ordem, fundo que passa de semana, anulação depois do fecho;
- presentes reais (Cuca 25 Kz para o artista, Grade 250 Kz), presente inválido ou a si próprio recusado;
- pontos: +10 só uma vez por episódio, 100 = 1 episódio sem mexer no livro-razão, sem gastar duas vezes em simultâneo, Fã n.º 1;
- ranking mensal por visualizações e receita;
- moedas: só entram depois de confirmadas e uma única vez; valor real com e sem bónus e com comissões; gasto das mais antigas primeiro sem perder cêntimos; sem saldo, não cobra; cliques simultâneos não cobram a dobrar; presentes; anulação de compra (com gastos misturados entre compras e com o artista já a ter levantado); relatório financeiro igual ao livro-razão;
- no fim, a soma de todo o livro-razão é zero.
