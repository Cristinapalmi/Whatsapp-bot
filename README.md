# Plataforma de minisséries angolanas (nome provisório: KONTA)

Web app (PWA, instalável no telemóvel) onde o público vê minisséries de criadores angolanos.
Os primeiros episódios são grátis; os seguintes desbloqueiam-se por pagamento. **50% de cada pagamento vai para o artista.**

> O nome, slogan, cores e domínio mudam-se **num só sítio**: `config/brand.ts` (ou as variáveis `NEXT_PUBLIC_BRAND_...` no `.env` / Vercel).

## Guias (linguagem simples)

| Guia | Para quê |
|---|---|
| [docs/INSTALAR.md](docs/INSTALAR.md) | Correr a app no teu computador |
| [docs/PUBLICAR.md](docs/PUBLICAR.md) | Pôr a app online (Supabase + Vercel, sem cartão) |
| [docs/OPERAR.md](docs/OPERAR.md) | O dia a dia: confirmar pagamentos, pagar artistas, carregar séries |
| [docs/VIDEOS.md](docs/VIDEOS.md) | Como preparar os vídeos (360p/480p) com o ffmpeg |
| [docs/TAREFAS-E-CUSTOS.md](docs/TAREFAS-E-CUSTOS.md) | O que tens de fazer, custos, e notas legais (BNA, APD) |
| [docs/DINHEIRO.md](docs/DINHEIRO.md) | Como funciona o livro-razão e as regras de dinheiro |
| [docs/TRAILERS.md](docs/TRAILERS.md) | Gerar os trailers de 30 s para o TikTok/Instagram |
| [docs/FASE-3.md](docs/FASE-3.md) | Onde entram os pagamentos automáticos no futuro |

## Estado

- **Fase 1 (MVP) — feita:** registos público/artista com políticas, episódios grátis + gancho, pagamento manual com comprovativo, confirmação no admin, carteira do artista (50%), levantamentos manuais + CSV, painel admin para séries/vídeos, denúncias, textos legais, dados de exemplo, testes das regras de dinheiro.
- **Fase 2 — feita:** passe semanal (300 Kz, 7 dias) com fecho semanal automático, presentes (Cuca, Muamba, Candonga, Grade), pontos de fã e Fã n.º 1, ranking mensal "Disputa dos artistas", link pessoal do artista com "Vieram por ti".
- **Fase 3 (parte 1) — feita:** trailers automáticos (`npm run trailer`), exportações avançadas (pagamentos, ganhos por artista, livro-razão, séries, aceitações da política) e extrato mensal do artista (imprimir/PDF/CSV).
- **Moedas — feita:** loja com pacotes, desbloquear episódios e presentes com moedas, 3 episódios grátis, catálogo logo à entrada, A minha lista, página de Membro ("Brevemente"), admin de moedas e relatório financeiro.
- **Fase 3 (parte 2) — quando houver prestador:** pagamentos automáticos (Multicaixa Express, PayPay, Referência) — a estrutura está pronta (ver `docs/FASE-3.md`).

## Tecnologia

Next.js 15 (App Router) + TypeScript + Tailwind · PostgreSQL + Storage no Supabase · Prisma · Vercel.

## Pastas principais

```
config/brand.ts        marca (nome, cores, domínio)
config/business.ts     regras (50%, mínimo de levantamento, dados de pagamento)
prisma/                base de dados e dados de exemplo
src/domain/money/      livro-razão e divisão do dinheiro
src/domain/payments/   PaymentProvider (manual + adaptadores futuros) e serviço de pagamentos
src/domain/payouts/    levantamentos dos artistas
src/app/               ecrãs (público, artista, admin, legal)
tests/                 testes automáticos das regras de dinheiro
```
