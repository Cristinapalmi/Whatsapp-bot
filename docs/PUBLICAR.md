# Pôr a app online (custo inicial: 0 €)

Vais criar 3 contas grátis: **Supabase** (base de dados), **Cloudflare R2** (vídeos, capas e comprovativos) e **Vercel** (o site). Todas aceitam entrar com a conta do GitHub.

## 1. Supabase — base de dados
1. https://supabase.com → "Start your project" → entra com o GitHub.
2. "New project": nome `minisseries`, escolhe uma palavra-passe forte (**guarda-a**), região **West EU (Ireland)** ou **Central EU (Frankfurt)** — as mais próximas de Angola com bom preço.
3. Quando estiver pronto: botão **Connect** (no topo) → separador "ORMs" → **Prisma**. Copia:
   - `DATABASE_URL` (porta **6543**, termina em `?pgbouncer=true`)
   - `DIRECT_URL` (porta **5432**)
   Substitui `[YOUR-PASSWORD]` pela palavra-passe do passo 2.

> Nota: no plano grátis, o projeto entra em pausa após 7 dias sem uso. Quando tiveres utilizadores reais, passa para o plano Pro (~25 $/mês).

## 2. Cloudflare R2 — ficheiros
1. https://dash.cloudflare.com → cria conta → menu **R2 Object Storage** → ativa (pede cartão, mas os primeiros 10 GB são grátis e **não pagas pelo tráfego de vídeo**).
2. Cria 2 "buckets": `minisseries-media` e `minisseries-privado`. Ambos **privados** (não ativar acesso público).
3. **R2 → Manage R2 API Tokens → Create API token**, permissão "Object Read & Write" nos dois buckets. Guarda o **Access Key ID**, o **Secret Access Key** e o endpoint (`https://<ID>.r2.cloudflarestorage.com`).
4. **CORS** (obrigatório para os vídeos tocarem e para o admin carregar vídeos): em cada bucket → Settings → CORS policy → cola (troca pelo teu domínio):
```json
[
  {
    "AllowedOrigins": ["https://o-teu-dominio.ao", "https://o-teu-projeto.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 3. Vercel — o site
1. https://vercel.com → entra com o GitHub → **Add New → Project** → escolhe o repositório.
2. "Branch": o ramo do projeto (ou o `main`, depois de juntares o código).
3. Em **Environment Variables**, adiciona todas as variáveis do `.env.example`, com os valores reais:
   - `DATABASE_URL`, `DIRECT_URL` (Supabase)
   - `SESSION_SECRET` (frase longa nova — não reutilizes a do computador)
   - `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_MEDIA`, `S3_BUCKET_PRIVATE`
   - `PAYMENT_MCX_NUMBER`, `PAYMENT_IBAN`, `PAYMENT_ACCOUNT_HOLDER`, `PAYMENT_BANK_NAME` (os teus dados reais)
   - `NEXT_PUBLIC_BRAND_DOMAIN` (ex.: `o-teu-projeto.vercel.app` ou o teu domínio)
   - `CRON_SECRET` (frase aleatória) — ativa o fecho semanal automático do passe (ficheiro `vercel.json`, segundas às 01:30 de Luanda; funciona no plano grátis)
4. **Deploy**. A Vercel cria as tabelas automaticamente (script `vercel-build`).
5. **Criar a tua conta admin** (uma vez), no teu computador, com o `.env` a apontar para o Supabase:
```bash
SEED_DEMO=false npm run db:seed
```
   (Sem `SEED_DEMO=false` cria também as 6 séries de exemplo — útil para mostrar a artistas, mas apaga-as/retira-as antes do lançamento.)

> ⚠️ Online, `STORAGE_DRIVER` **tem de ser** `s3`. A Vercel não guarda ficheiros no disco.

## 4. Domínio próprio (opcional, ~10–15 €/ano)
Vercel → o teu projeto → Settings → Domains → adiciona o domínio e segue as instruções de DNS. Depois atualiza `NEXT_PUBLIC_BRAND_DOMAIN` e o CORS do R2.

## 5. Instalar no telemóvel
Abre o site no Chrome do Android → menu ⋮ → **"Adicionar ao ecrã principal"**.

## Mudar o nome da marca
Vercel → Settings → Environment Variables → muda `NEXT_PUBLIC_BRAND_NAME` (e slogan/cores) → **Redeploy**. Para os ícones com a nova inicial: `node scripts/generate-icons.mjs "NOVONOME"` no computador e envia as alterações.
