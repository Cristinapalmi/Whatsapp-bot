# Trailers

> **Agora:** o artista carrega o seu trailer no painel da série (Trailer → Carregar). Ninguém precisa de correr comandos.
> O gerador automático abaixo continua disponível para quem é técnico, mas é opcional.

# Gerador automático (opcional, técnico)

Cada série pode ter um **trailer vertical de ~30 s** (formato TikTok/Instagram Reels/Stories):

1. **Até 25 s** do episódio 1, com fundo desfocado (funciona com vídeos horizontais e verticais) e o nome da marca no topo.
2. **5 s de cartão final:** título da série, "O resto está em **[MARCA]**" e "link na bio · dominio/artista".

O artista vê o botão **"Descarregar trailer"** no painel, com uma legenda pronta a copiar. Quem chega pelo link conta em "Vieram por ti".

## Gerar (no teu computador)
O trailer é feito no **teu computador** (a Vercel grátis não tem força para editar vídeo). Não precisas de instalar o ffmpeg: vem com o projeto.

```bash
npm run trailer -- a-kianda-do-mussulo
```
- O nome a seguir a `--` é o link da série (aparece no endereço `/serie/...` e no admin).
- O `.env` tem de apontar para a base de dados e para o armazenamento online (os mesmos valores da Vercel), para o trailer ir parar à app.

Opções:
| Opção | Para quê |
|---|---|
| `--inicio 12` | começar no segundo 12 (escolhe um momento forte) |
| `--duracao 20` | excerto mais curto (máximo 25 s) |
| `--episodio 2` | tirar o excerto de outro episódio |
| `--sem-enviar` | só criar o ficheiro em `trailers/`, sem o enviar para a app |

Para todas as séries publicadas que ainda não têm trailer:
```bash
npm run trailer -- todas
```

## Trailer feito à mão
Se preferires editar no CapCut, por exemplo: Admin → Séries → a série → **"Ou carregar um trailer feito à mão"**. O artista é avisado na mesma.

## Mudar o aspeto
- Cores e nome: vêm de `config/brand.ts` (ou das variáveis `NEXT_PUBLIC_BRAND_...`).
- Fonte: Bricolage Grotesque em `assets/fonts` (licença OFL, uso livre).
- Desenho do cartão final: `src/domain/trailer-images.ts`. Montagem do vídeo: `src/domain/trailer.ts`.
