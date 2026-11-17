# Preparar os vídeos

A internet em Angola é cara: vídeos **pequenos** = mais gente a ver. Usa o programa grátis **ffmpeg** (https://ffmpeg.org/download.html).

## Versão 360p (obrigatória, ~3–6 MB por minuto)
```bash
ffmpeg -i original.mp4 -vf "scale=-2:360" -c:v libx264 -profile:v baseline -preset slow -crf 28 \
  -c:a aac -b:a 64k -ac 1 -movflags +faststart ep01-360.mp4
```

## Versão 480p (opcional, ~6–10 MB por minuto)
```bash
ffmpeg -i original.mp4 -vf "scale=-2:480" -c:v libx264 -profile:v main -preset slow -crf 27 \
  -c:a aac -b:a 96k -movflags +faststart ep01-480.mp4
```

Vídeos verticais (TikTok) funcionam na mesma: o `scale=-2:360` mantém as proporções. Se preferires limitar pela largura num vídeo vertical, usa `scale=360:-2`.

- `-movflags +faststart` permite começar a ver antes de o ficheiro descarregar todo (essencial).
- Legendas: ficheiro `.vtt` (texto). Podes criar no https://subtitletools.com ou converter de `.srt`.

## Fase seguinte (quando houver orçamento)
Bunny Stream ou Cloudflare Stream convertem automaticamente para **HLS** (qualidade adaptável à rede). O código já tem o adaptador preparado em `src/domain/video/index.ts`.
