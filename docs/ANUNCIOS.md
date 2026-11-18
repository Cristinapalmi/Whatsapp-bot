# Anúncios: oferta única e fundo dos artistas

## Como funciona para o fã
- No ecrã de um episódio bloqueado aparece **"Ver anúncio e desbloquear grátis (oferta única)"**, ao lado de "Desbloquear por X moedas".
- Só com a conta iniciada. Cada conta pode usar a oferta **1 vez no total, para sempre** (o número muda-se em Admin → Anúncios). O limite também vale por **número de telefone**, mesmo que a conta seja apagada e criada de novo.
- O anúncio tem de ser visto até ao fim: o **servidor** mede o tempo entre o início e o fim. Não dá para saltar para a frente nem desbloquear duas vezes.
- No fim desse episódio aparece **"Gostaste? Continua já por X moedas"**, com o botão para desbloquear o seguinte ou ir à Loja.

## Anúncios da casa (Admin → Anúncios)
1. **Criar:** escreve o patrocinador (e o link, se houver) e carrega em "Criar".
2. **Carregar o vídeo:** MP4 curto (15–30 s, 360p ou 480p). Fica no Supabase, como os episódios. A duração é lida automaticamente.
3. **Datas e estado:** podes marcar quando começa e acaba, e ativar ou desativar.
4. Em cada anúncio vês quantas vezes começou a ser visto e quantas vezes foi visto até ao fim.

## Receita e pagamento aos artistas
1. Quando um patrocinador te paga, registas o valor em **Admin → Anúncios → Receita de anúncios** (com o mês).
2. Metade desse valor vai para o **fundo de anúncios desse mês**.
3. Depois de o mês terminar, carregas em **"Dividir pelos artistas"**. O fundo é dividido conforme os episódios de cada artista desbloqueados com anúncio nesse mês e entra no saldo disponível dele. Se não houve episódios com anúncio, o fundo passa para o mês seguinte.
4. Tudo fica no livro-razão (dupla entrada) e aparece em **Admin → Financeiro**, no CSV e no extrato do artista ("Anúncios").

## Rede de anúncios externa (preparada, desligada)
O ficheiro `src/domain/ads/provider.ts` tem a interface **AdProvider**:
- `house`: os anúncios da casa (ativo);
- `google-ad-manager`: **vazio e desligado**.

Para usar uma rede externa com anúncios recompensados para web (por exemplo, Google Ad Manager), é preciso:
1. Uma conta aprovada na rede e um bloco de anúncios "rewarded" configurado para o site.
2. Implementar `pickAd()` (ou um fluxo próprio da rede) e confirmar a recompensa do lado do servidor antes de chamar `completeAdView()`.
3. Atualizar a Política de Privacidade (cookies e dados partilhados com a rede).

**Não há nenhuma integração inventada no código.**
