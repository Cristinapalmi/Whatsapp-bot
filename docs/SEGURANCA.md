# Segurança

## O que a app faz sozinha
- **Base de dados (Supabase):** RLS ativo em todas as tabelas, sem políticas públicas, e permissões retiradas aos papéis `anon`/`authenticated`. A Data API do Supabase (chaves anon/publishable) não lê nem escreve nada; a app usa só o servidor (Prisma). Cada deploy volta a confirmar o RLS.
- **Ficheiros:** buckets privados; links temporários; nomes aleatórios; tipo real confirmado no servidor (pelos primeiros bytes) para imagens, PDF, legendas e vídeos; limite de 50 MB nos vídeos; vídeos pagos só com desbloqueio.
- **Admin:** todas as páginas, ações e rotas verificam a permissão no servidor; **2 passos obrigatórios** (app de autenticação); sessão de 12 horas; registo de auditoria das ações.
- **Contas:** palavras-passe com mínimo 8 caracteres e hash forte (bcrypt 12; os antigos são atualizados no login); 5 tentativas falhadas por telefone (ou 30 por IP) em 15 min; no máximo 15 contas novas por IP por hora; campo-armadilha contra robôs.
- **Dinheiro:** preços, moedas e saldos calculados só no servidor; moedas e levantamentos em transações com bloqueio; um levantamento em processamento de cada vez; contabilidade em dupla entrada.
- **Navegador:** CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; proteção CSRF nas ações e rotas POST.

## Autenticação em 2 passos da admin
1. No primeiro login aparece um código QR: lê-o com Google Authenticator, Microsoft Authenticator ou Authy e escreve o código.
2. Guarda os **8 códigos de recuperação** (aparecem uma vez).
3. Perdeste o telemóvel e os códigos? Na Vercel, cria a variável `ADMIN_RESET_2FA=true`, faz **Redeploy**, entra e configura de novo — depois **apaga** a variável.

## Verificar no Supabase
- **Advisors → Security Advisor**: não deve haver avisos "RLS disabled".
- **Storage**: os buckets `media` e `privado` têm de estar **privados** (sem "Public").
- Se não usares a Data API para nada, podes desligá-la em **Project Settings → Data API**.
