# Correr a app no teu computador

Precisas de fazer isto **uma vez**. Depois, para abrir a app basta o passo 6.

## 1. Instalar os programas
1. **Node.js** (versão 22 ou mais recente): https://nodejs.org → botão "LTS" → instalar.
2. **Git**: https://git-scm.com → instalar com as opções por defeito.
3. **PostgreSQL** (a base de dados) — escolhe UMA opção:
   - **Mais fácil:** não instalar nada e usar a base de dados grátis do Supabase (ver `PUBLICAR.md`, passo 1) também no computador.
   - Ou instalar o PostgreSQL: https://www.postgresql.org/download/ (guarda a palavra-passe que escolheres).

## 2. Descarregar o projeto
Abre o "Terminal" (Mac) ou "PowerShell" (Windows) e escreve:
```bash
git clone https://github.com/cristinapalmi/whatsapp-bot.git minisseries
cd minisseries
```

## 3. Instalar as dependências
```bash
npm install
```
(Demora 1–3 minutos.)

## 4. Configurar
```bash
cp .env.example .env
```
Abre o ficheiro `.env` num editor de texto (Bloco de Notas, VS Code) e muda:
- `DATABASE_URL` e `DIRECT_URL` → o endereço da tua base de dados (Supabase ou local).
- `SESSION_SECRET` → uma frase longa e aleatória (mín. 32 caracteres).
- `ADMIN_PHONE` e `ADMIN_PASSWORD` → o teu telefone e a palavra-passe de administração.
- Deixa `STORAGE_DRIVER="local"` (os ficheiros ficam na pasta `storage/`). Para testar com o Supabase Storage no computador, segue `PUBLICAR.md` (passos 2 e 3).

## 5. Criar as tabelas e os dados de exemplo
```bash
npx prisma migrate deploy
npm run db:seed
```

## 6. Abrir a app
```bash
npm run dev
```
Abre o navegador em **http://localhost:3000**.

### Contas de teste
| Quem | Telefone | Palavra-passe |
|---|---|---|
| Administração | o `ADMIN_PHONE` do `.env` | o `ADMIN_PASSWORD` do `.env` |
| Artista (Mana Zinha) | 900 000 002 | artista123 |
| Fã | 900 000 003 | fa123456 |

## 7. Correr os testes das regras de dinheiro
Precisas de uma **segunda base de dados só para testes** (é apagada a cada teste!). No `.env`:
```
TEST_DATABASE_URL="postgresql://postgres:SENHA@localhost:5432/app_test"
```
(o nome tem de conter `test`, por segurança). Depois:
```bash
npm test
```
Deves ver `Tests 26 passed`.

## Problemas comuns
- **"Can't reach database server"** → a base de dados não está ligada ou o endereço no `.env` está errado.
- **"SESSION_SECRET em falta"** → preenche-o no `.env` com 32+ caracteres.
- **Porta 3000 ocupada** → `npm run dev -- -p 3001` e abre http://localhost:3001.
