# O que tens de fazer, custos e notas legais

## Lista de tarefas — Fase 1
- [ ] Criar conta **GitHub** (já tens) e confirmar acesso ao repositório.
- [ ] Criar conta **Supabase** (grátis) e um projeto → copiar `DATABASE_URL` e `DIRECT_URL`.
- [ ] Criar conta **Cloudflare** e ativar **R2** (pede cartão; 10 GB grátis) → 2 buckets + chave API + CORS.
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
| Arranque (até ~1.000 utilizadores) | Supabase grátis + R2 grátis (10 GB) + Vercel grátis | **0 $** (+ domínio ~1 $/mês) |
| Crescimento (~10.000 utilizadores) | Supabase Pro 25 $ + R2 ~0,015 $/GB guardado (100 GB ≈ 1,5 $) + Vercel grátis ou Pro 20 $ | **~27–50 $** |
| Vídeo com HLS automático | Bunny Stream (~0,005 $/GB guardado + ~0,005–0,01 $/GB entregue) | **+5–30 $** conforme os minutos vistos |
| SMS para códigos (Fase 3) | depende do fornecedor angolano | por mensagem |

Porquê R2: o Cloudflare R2 **não cobra pelo tráfego de saída** — num site de vídeo é a maior poupança.

## Notas legais importantes (confirmar com jurista)
1. **BNA — guardar saldos de artistas.** A app regista quanto se deve a cada artista ("carteira"). Confirmar se isto é apenas uma dívida comercial registada (normal) ou se pode ser visto como emissão de moeda eletrónica / serviço de pagamento, que exige autorização do Banco Nacional de Angola. **Por isso o público não tem saldo pré-pago na app.**
2. **Prestador futuro:** perguntar se o prestador pode pagar **diretamente** aos artistas (split de pagamento), o que reduz o risco do ponto 1.
3. **APD — proteção de dados (Lei 22/11):** confirmar se é preciso notificar/obter autorização da Agência de Proteção de Dados antes de começar, sobretudo por guardar o n.º do BI e por os servidores estarem fora de Angola.
4. **Impostos:** a receita da plataforma (50%) é rendimento teu/da empresa. Falar com um contabilista sobre IVA e imposto industrial/rendimentos, e sobre a obrigação de emitir faturas.
5. **Proibido:** apostas, sorteios pagos, "ganha dinheiro a ver vídeos". Os pontos de fã não valem dinheiro (já está assim no código e nos Termos).
6. **Empresa:** quando houver receita regular, constituir empresa (ex.: no Guiché Único) — necessário para contratar um prestador de pagamentos.
