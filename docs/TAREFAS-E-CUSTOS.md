# O que tens de fazer, custos e notas legais

## Lista de tarefas — Fase 1
- [ ] Criar conta **GitHub** (já tens) e confirmar acesso ao repositório.
- [ ] Criar conta **Supabase** (grátis, sem cartão) e um projeto → copiar `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL` e a chave secreta.
- [ ] Criar os 2 buckets privados (`media` e `privado`) — `npm run storage:setup` faz isto sozinho.
- [ ] Criar conta **Vercel** (grátis) e importar o projeto.
- [ ] Decidir o **número Multicaixa Express** e o **IBAN** que aparecem no ecrã de pagamento (idealmente uma conta só para a plataforma, para ser fácil conferir).
- [ ] Escolher a **palavra-passe de administração** e o `SESSION_SECRET`.
- [ ] (Opcional) Comprar o **domínio** quando o nome final estiver decidido.
- [ ] Rever os **textos legais** com um jurista e preencher os campos [entre parênteses] (responsável, NIF, morada).
- [ ] Imprimir o **Acordo do Artista** (`/legal/acordo-artista`, imprimir a página) para os primeiros artistas assinarem.
- [ ] Retirar as séries de exemplo antes do lançamento (Admin → Séries → Retirar).

## Custos mensais esperados (valores aproximados — confirma nos sites)
| Fase | Serviços | Custo/mês |
|---|---|---|
| Arranque (testes e primeiros fãs) | Supabase grátis (BD + 1 GB de ficheiros + ~5 GB/mês de tráfego) + Vercel grátis | **0 $** (+ domínio ~1 $/mês) |
| Crescimento (~10.000 utilizadores) | Supabase Pro 25 $ (100 GB de ficheiros, 250 GB/mês de tráfego) + Vercel grátis ou Pro 20 $ | **~25–50 $** |
| Muito tráfego de vídeo | tráfego extra no Supabase ~0,09 $/GB — ou passar os ficheiros para o Cloudflare R2 (sem custo de tráfego, pede cartão) | conforme o uso |
| Vídeo com HLS automático | Bunny Stream (~0,005 $/GB guardado + ~0,005–0,01 $/GB entregue) | **+5–30 $** conforme os minutos vistos |
| SMS para códigos (Fase 3) | depende do fornecedor angolano | por mensagem |

Atenção ao **tráfego de vídeo**: no plano grátis do Supabase, ~5 GB/mês dão para uns 500–1.000 episódios vistos. É o primeiro limite que vais atingir — quando isso acontecer, passa para o Pro (já com receita). O código também suporta o Cloudflare R2 (`STORAGE_DRIVER=s3`) se um dia tiveres cartão e quiseres poupar no tráfego.

## Notas legais importantes (confirmar com jurista)
1. **BNA — guardar saldos de artistas.** A app regista quanto se deve a cada artista ("carteira"). Confirmar se isto é apenas uma dívida comercial registada (normal) ou se pode ser visto como emissão de moeda eletrónica / serviço de pagamento, que exige autorização do Banco Nacional de Angola. **Por isso o público não tem saldo pré-pago na app.**
2. **Prestador futuro:** perguntar se o prestador pode pagar **diretamente** aos artistas (split de pagamento), o que reduz o risco do ponto 1.
3. **APD — proteção de dados (Lei 22/11):** confirmar se é preciso notificar/obter autorização da Agência de Proteção de Dados antes de começar, sobretudo por guardar o n.º do BI e por os servidores estarem fora de Angola.
4. **Impostos:** a receita da plataforma (50%) é rendimento teu/da empresa. Falar com um contabilista sobre IVA e imposto industrial/rendimentos, e sobre a obrigação de emitir faturas.
5. **Proibido:** apostas, sorteios pagos, "ganha dinheiro a ver vídeos". Os pontos de fã não valem dinheiro (já está assim no código e nos Termos).
6. **Empresa:** quando houver receita regular, constituir empresa (ex.: no Guiché Único) — necessário para contratar um prestador de pagamentos.
