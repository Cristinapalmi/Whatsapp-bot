# Fase 3 — pagamentos automáticos (preparado, não ativo)

## Onde está cada peça
| Ficheiro | O que faz |
|---|---|
| `src/domain/payments/provider.ts` | A interface `PaymentProvider` que todos os prestadores seguem |
| `src/domain/payments/providers/manual.ts` | O prestador ativo hoje (comprovativo + confirmação manual) |
| `src/domain/payments/providers/multicaixa-express.ts` | Adaptador **vazio** |
| `src/domain/payments/providers/paypay.ts` | Adaptador **vazio** |
| `src/domain/payments/providers/reference.ts` | Adaptador **vazio** (pagamento por referência) |
| `src/domain/payments/index.ts` | Lista de prestadores; `ACTIVE_PROVIDERS` diz quais aparecem ao público |
| `src/app/api/webhooks/payments/[provider]/route.ts` | Endereço que o prestador chama quando um pagamento é concluído |

**Não há nenhuma API inventada no código.** As APIs reais vêm do prestador angolano autorizado que contratares (documentação, ambiente de testes, credenciais e segredo do webhook).

## Passos quando houver contrato
1. Pedir ao prestador: documentação, credenciais de **teste**, segredo de webhook, lista de comissões, e se faz **split** (pagar diretamente ao artista).
2. Guardar as credenciais **só** em variáveis de ambiente (Vercel), ex.: `MULTICAIXA_EXPRESS_API_URL`, `MULTICAIXA_EXPRESS_API_KEY`, `MULTICAIXA_EXPRESS_WEBHOOK_SECRET`.
3. Implementar `initiate()` e `parseWebhook()` no adaptador (validar sempre a assinatura).
4. Registar o webhook no painel do prestador: `https://<dominio>/api/webhooks/payments/multicaixa-express`.
5. O webhook chama `confirmPayment()` — a mesma função do botão "Confirmar". Repetições do webhook não creditam duas vezes.
6. Decidir se o crédito do artista vai para **pendente** até o prestador liquidar o dinheiro (recomendado) e criar o lançamento "pendente → disponível" na liquidação.
7. Acrescentar o prestador a `ACTIVE_PROVIDERS`.

## Outras peças da Fase 3
- **Código por SMS/WhatsApp (OTP)** no registo — `src/lib/auth.ts`.
- **Vídeo HLS** (Bunny/Cloudflare Stream) — `src/domain/video/index.ts`.
- **Trailers automáticos** de ~30 s com ffmpeg ("O resto está em [nome] · link na bio").
