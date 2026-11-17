# Plataforma de minisséries angolanas (nome provisório: KONTA)

Web app (PWA, instalável no telemóvel) onde o público vê minisséries de criadores angolanos.
Os primeiros episódios são grátis; os seguintes desbloqueiam-se por pagamento. **50% de cada pagamento vai para o artista.**

> O nome, slogan, cores e domínio mudam-se **num só sítio**: `config/brand.ts` (ou as variáveis `NEXT_PUBLIC_BRAND_...` no `.env` / Vercel).

## Guias (linguagem simples)

| Guia | Para quê |
|---|---|
| [docs/INSTALAR.md](docs/INSTALAR.md) | Correr a app no teu computador |
| [docs/PUBLICAR.md](docs/PUBLICAR.md) | Pôr a app online (Supabase + Cloudflare R2 + Vercel) |
| [docs/OPERAR.md](docs/OPERAR.md) | O dia a dia: confirmar pagamentos, pagar artistas, carregar séries |
| [docs/VIDEOS.md](docs/VIDEOS.md) | Como preparar os vídeos (360p/480p) com o ffmpeg |
| [docs/TAREFAS-E-CUSTOS.md](docs/TAREFAS-E-CUSTOS.md) | O que tens de fazer, custos, e notas legais (BNA, APD) |
| [docs/DINHEIRO.md](docs/DINHEIRO.md) | Como funciona o livro-razão e as regras de dinheiro |
| [docs/FASE-3.md](docs/FASE-3.md) | Onde entram os pagamentos automáticos no futuro |

## Estado

- **Fase 1 (MVP) — feita:** registos público/artista com políticas, episódios grátis + gancho, pagamento manual com comprovativo, confirmação no admin, carteira do artista (50%), levantamentos manuais + CSV, painel admin para séries/vídeos, denúncias, textos legais, dados de exemplo, testes das regras de dinheiro.
- **Fase 2 — feita:** passe semanal (300 Kz, 7 dias) com fecho semanal automático, presentes (Cuca, Muamba, Candonga, Grade), pontos de fã e Fã n.º 1, ranking mensal "Disputa dos artistas", link pessoal do artista com "Vieram por ti".
- **Fase 3:** pagamentos automáticos via prestador, trailers automáticos, exportações avançadas.

## Tecnologia

Next.js 15 (App Router) + TypeScript + Tailwind · PostgreSQL (Supabase) + Prisma · Cloudflare R2 para ficheiros · Vercel.

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
legacy/                código antigo do bot de WhatsApp (não usado)
```
