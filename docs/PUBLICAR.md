# Pôr a app online (custo inicial: 0 €, sem cartão)

Precisas de **2 contas grátis**, as duas sem cartão:
- **Supabase**: base de dados **e** ficheiros (vídeos, capas, trailers, comprovativos).
- **Vercel**: o site.

Entra nas duas com a tua conta do **GitHub** (botão "Continue with GitHub").

---

## 1. Supabase: criar o projeto e copiar a base de dados

1. Vai a https://supabase.com e carrega em **Start your project**. Entra com o GitHub.
2. Carrega em **New project** e preenche:
   - **Name:** `minisseries` (ou o que quiseres).
   - **Database Password:** carrega em "Generate a password" e **guarda-a num sítio seguro**.
   - **Region:** **West EU (Ireland)** ou **Central EU (Frankfurt)**, as mais próximas de Angola.
3. Carrega em **Create new project** e espera 1–2 minutos.
4. No topo da página, carrega em **Connect** → separador **ORMs** → escolhe **Prisma**. Copia os dois valores:
   - `DATABASE_URL`: tem a porta **6543** e termina em `?pgbouncer=true`.
   - `DIRECT_URL`: tem a porta **5432**.

   Em ambos, troca `[YOUR-PASSWORD]` pela palavra-passe do passo 2.

## 2. Supabase: copiar as chaves de acesso aos ficheiros

1. No menu da esquerda, carrega no ícone da roda dentada (**Project Settings**).
2. Em **Data API**, copia o **Project URL**, por exemplo `https://abcdefgh.supabase.co`. Este é o `SUPABASE_URL`.
3. Em **API Keys**, copia a chave **secreta**. Pode aparecer de duas formas:
   - **Secret key**, que começa por `sb_secret_...` (carrega em "Reveal" para a ver);
   - ou, no separador "Legacy API keys", a chave **`service_role`** (carrega em "Reveal").

   Esta é a `SUPABASE_SERVICE_ROLE_KEY`.

> ⚠️ **A chave secreta dá acesso total ao projeto.** Usa-a **só** no `.env` e nas variáveis da Vercel. Nunca a mandes por WhatsApp, nunca a publiques, e nunca a ponhas numa variável que comece por `NEXT_PUBLIC_`. **Não** uses a chave "anon"/"publishable": essa é pública e não serve aqui.

## 3. Supabase: criar os 2 buckets (pastas de ficheiros)

Os dois buckets têm de ser **privados**. Os ficheiros só se abrem com links temporários criados pela app, por isso ninguém consegue partilhar um episódio pago nem ver comprovativos.

### Opção A: automática (recomendada)
No teu computador, com o `.env` preenchido com `STORAGE_DRIVER="supabase"`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, corre:
```bash
npm run storage:setup
```
O comando cria os buckets e **testa tudo**: guarda um ficheiro, abre-o, faz um envio direto e apaga-o. No fim tem de aparecer `Supabase Storage pronto.`

### Opção B: à mão, no site do Supabase
1. No menu da esquerda, carrega em **Storage** → **New bucket**.
2. Primeiro bucket:
   - **Name:** `media`
   - **Public bucket:** **desligado** (privado)
   - Abre **Additional configuration** e preenche:
     - **Restrict file size:** ligado, **50 MB**
     - **Allowed MIME types:** `video/mp4, video/webm, image/jpeg, image/png, image/webp, image/svg+xml, text/vtt`
   - Carrega em **Save**.
3. Segundo bucket:
   - **Name:** `privado`
   - **Public bucket:** **desligado**
   - **Restrict file size:** **5 MB**
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp, application/pdf`
   - Carrega em **Save**.
4. Não precisas de criar "policies" (regras de acesso). A app usa a chave secreta no servidor e cria links temporários para cada ficheiro.

Se quiseres outros nomes, usa-os nas variáveis `SUPABASE_BUCKET_MEDIA` e `SUPABASE_BUCKET_PRIVATE`.

> Limite do plano grátis: **50 MB por ficheiro**. Um episódio de 3 minutos em 360p tem uns 10–18 MB, por isso cabe bem. Vê `docs/VIDEOS.md` para comprimir os vídeos.

## 4. Vercel: publicar o site

1. Vai a https://vercel.com, entra com o GitHub e carrega em **Add New → Project**.
2. Escolhe o repositório `Whatsapp-bot` e carrega em **Import**.
3. Abre **Environment Variables** e acrescenta, uma a uma, as variáveis desta tabela:

| Nome | Valor | De onde vem |
|---|---|---|
| `DATABASE_URL` | `postgresql://...:6543/postgres?pgbouncer=true` | Passo 1.4 |
| `DIRECT_URL` | `postgresql://...:5432/postgres` | Passo 1.4 |
| `SESSION_SECRET` | uma frase longa e aleatória (mín. 32 caracteres) | Inventas tu |
| `CRON_SECRET` | outra frase aleatória | Inventas tu (fecho semanal do passe) |
| `STORAGE_DRIVER` | `supabase` | Escreve exatamente isto |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Passo 2.2 |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` ou a chave `service_role` | Passo 2.3 (**secreta**) |
| `SUPABASE_BUCKET_MEDIA` | `media` | Passo 3 |
| `SUPABASE_BUCKET_PRIVATE` | `privado` | Passo 3 |
| `PAYMENT_MCX_NUMBER` | o teu número Multicaixa Express | Os teus dados |
| `PAYMENT_IBAN` | o teu IBAN (AO06…) | Os teus dados |
| `PAYMENT_ACCOUNT_HOLDER` | nome do titular da conta | Os teus dados |
| `PAYMENT_BANK_NAME` | nome do banco | Os teus dados |
| `NEXT_PUBLIC_BRAND_DOMAIN` | `o-teu-projeto.vercel.app` (ou o teu domínio) | Endereço do site |

Opcionais (têm valores por defeito): `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_SLOGAN`, `NEXT_PUBLIC_BRAND_COLOR_ACCENT`, `NEXT_PUBLIC_BRAND_COLOR_ACCENT2`, `NEXT_PUBLIC_BRAND_SUPPORT_EMAIL`, `NEXT_PUBLIC_BRAND_SUPPORT_WHATSAPP`, `MIN_WITHDRAWAL_KZ`, `MAX_PENDING_PAYMENTS_PER_USER`.

4. Carrega em **Deploy**. A Vercel cria as tabelas da base de dados sozinha (script `vercel-build`).
5. Quando acabar, abre o endereço do site, por exemplo `https://o-teu-projeto.vercel.app`. Se o endereço for diferente do que puseste em `NEXT_PUBLIC_BRAND_DOMAIN`, corrige essa variável e carrega em **Redeploy**.

> Online, o `STORAGE_DRIVER` **tem de ser** `supabase`. A Vercel não guarda ficheiros no disco: com `local`, os comprovativos e os vídeos perdiam-se.

## 5. Criar a tua conta de administração (uma vez)

No teu computador, põe no `.env` os **mesmos** `DATABASE_URL` e `DIRECT_URL` do Supabase, mais `ADMIN_PHONE` e `ADMIN_PASSWORD`, e corre:
```bash
SEED_DEMO=false npm run db:seed
```
No Windows (PowerShell): `$env:SEED_DEMO="false"; npm run db:seed`

Sem `SEED_DEMO=false`, o comando também cria as 6 séries de exemplo. É útil para mostrar a artistas, mas retira-as antes do lançamento.

## 6. Verificar que tudo funciona
1. Entra como admin → **Séries** → abre uma série → carrega uma capa e um vídeo pequeno. A barra de progresso tem de chegar aos 100%.
2. Abre a série no telemóvel e carrega em play.
3. Cria uma conta de fã de teste, envia um comprovativo e confirma-o no admin. O comprovativo tem de aparecer em **Pagamentos**.

Se alguma coisa falhar, corre `npm run storage:setup` no computador: a mensagem de erro diz o que está mal.

## 7. Domínio próprio (opcional, ~10–15 €/ano)
Na Vercel: o teu projeto → **Settings → Domains** → adiciona o domínio e segue as instruções. Depois atualiza `NEXT_PUBLIC_BRAND_DOMAIN` e carrega em **Redeploy**.

## 8. Instalar no telemóvel
No Android, abre o site no Chrome → menu ⋮ → **Adicionar ao ecrã principal**.

## Mudar o nome da marca
Na Vercel: **Settings → Environment Variables** → muda `NEXT_PUBLIC_BRAND_NAME` (e o slogan e as cores, se quiseres) → **Redeploy**. Para os ícones ficarem com a nova inicial, corre no computador `node scripts/generate-icons.mjs "NOVONOME"` e envia as alterações para o GitHub.

---

## Limites do plano grátis e quando pagar (confirma os valores no site do Supabase)
| | Grátis | Pro (~25 $/mês) |
|---|---|---|
| Base de dados | 500 MB | 8 GB |
| Ficheiros guardados | 1 GB (~70–100 episódios de 3 min em 360p) | 100 GB |
| Tráfego de saída (vídeos vistos) | ~5 GB/mês (~500–1.000 episódios vistos) | 250 GB/mês (~25.000–50.000), depois ~0,09 $/GB |
| Pausa por inatividade | sim, após 7 dias sem uso | não |

Na prática, o plano grátis chega para testes e para os primeiros fãs. Quando tiveres algumas centenas de visualizações por mês, passa para o **Pro**. Para isso já precisas de cartão, mas também já terás receita.

**Mais tarde (opcional):** se o tráfego de vídeo ficar caro, podes passar só os ficheiros para o Cloudflare R2, que não cobra o tráfego. Basta mudar `STORAGE_DRIVER=s3` e preencher as variáveis `S3_...`. O código já suporta, sem mudar mais nada.
