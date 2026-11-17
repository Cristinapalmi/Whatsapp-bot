/**
 * TRAILERS AUTOMÁTICOS (~30 s, vertical 9:16) para os artistas publicarem no TikTok/Instagram.
 *
 * Estrutura do trailer:
 *   [ excerto do episódio, com fundo desfocado e o nome da marca no topo ]  (até 25 s)
 *   [ cartão final: "O resto está em <MARCA> · link na bio" + link pessoal ]   (5 s)
 *
 * Este ficheiro só CONSTRÓI o comando do ffmpeg (fácil de testar). As imagens com o texto
 * são desenhadas em trailer-images.ts. Quem executa tudo é o script `npm run trailer`
 * (scripts/trailer.ts), no computador da administração.
 */

export type ProbeInfo = { durationSec: number; hasAudio: boolean };

/** Lê a duração e se há som a partir da saída de "ffmpeg -i ficheiro". */
export function parseProbe(stderr: string): ProbeInfo {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const durationSec = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
  return { durationSec, hasAudio: /Stream #\d+:\d+.*Audio:/.test(stderr) };
}

export type TrailerTexts = {
  /** Nome da marca, no topo do vídeo e em grande no cartão final. */
  brand: string;
  /** Título da série (no cartão final). */
  title: string;
  /** "O resto está em" */
  restIn: string;
  /** "link na bio · dominio/artista" */
  linkLine: string;
};

export type TrailerPlan = {
  input: string;
  output: string;
  startSec: number;
  clipSec: number;
  endCardSec: number;
  hasAudio: boolean;
  /** Imagem PNG transparente com o nome da marca (sobreposta ao excerto). */
  bannerPng: string;
  /** Imagem PNG do cartão final ("O resto está em …"). */
  endCardPng: string;
  width?: number;
  height?: number;
};

/** Escolhe o excerto: começa em `startSec` e dura no máximo `maxClip` segundos (sem passar o fim do vídeo). */
export function chooseClip(durationSec: number, startSec = 0, maxClip = 25) {
  if (durationSec <= 0) throw new Error("Não foi possível ler a duração do vídeo.");
  const start = Math.max(0, Math.min(startSec, Math.max(0, durationSec - 3)));
  const clip = Math.max(1, Math.min(maxClip, durationSec - start));
  return { startSec: Number(start.toFixed(2)), clipSec: Number(clip.toFixed(2)) };
}

/**
 * Comando do ffmpeg. Os textos vêm em imagens PNG (ver trailer-images.ts), por isso
 * funciona com qualquer versão do ffmpeg, mesmo sem o filtro de texto.
 */
export function buildTrailerArgs(p: TrailerPlan): string[] {
  const W = p.width ?? 720;
  const H = p.height ?? 1280;
  const D = p.clipSec;
  const E = p.endCardSec;
  const filters = [
    `[0:v]trim=start=${p.startSec}:duration=${D},setpts=PTS-STARTPTS,fps=30,split=2[a][b]`,
    `[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2[bg]`,
    `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`,
    `[1:v]scale=${W}:-1[banner]`,
    `[base][banner]overlay=0:0,setsar=1,format=yuv420p,fade=t=out:st=${Math.max(0, D - 0.5)}:d=0.5[main]`,
    `[2:v]scale=${W}:${H},setsar=1,fps=30,format=yuv420p,trim=duration=${E},setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.4[end]`,
    p.hasAudio
      ? `[0:a]atrim=start=${p.startSec}:duration=${D},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=out:st=${Math.max(0, D - 1)}:d=1[ma]`
      : `anullsrc=r=44100:cl=stereo,atrim=duration=${D}[ma]`,
    `anullsrc=r=44100:cl=stereo,atrim=duration=${E}[ea]`,
    `[main][ma][end][ea]concat=n=2:v=1:a=1[v][aout]`,
  ];
  return [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", p.input,
    "-i", p.bannerPng,
    "-loop", "1", "-t", String(E), "-i", p.endCardPng,
    "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    p.output,
  ];
}

/** Texto sugerido para o artista publicar junto com o trailer. */
export function trailerCaption(opts: { title: string; brand: string; link: string }) {
  return `${opts.title} — o episódio 1 já está aqui. O resto está em ${opts.brand} · link na bio (${opts.link}) #minisserie #angola #${opts.brand.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}
