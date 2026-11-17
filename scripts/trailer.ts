/**
 * GERAR TRAILER DE UMA SÉRIE (corre no teu computador)
 *
 *   npm run trailer -- <link-da-serie> [opções]
 *
 * Exemplos:
 *   npm run trailer -- a-kianda-do-mussulo
 *   npm run trailer -- a-kianda-do-mussulo --inicio 12 --duracao 20
 *   npm run trailer -- todas                 (gera para todas as séries publicadas sem trailer)
 *
 * Opções:
 *   --episodio N    episódio de onde tirar o excerto (por defeito 1)
 *   --inicio S      segundo onde começa o excerto (por defeito 0)
 *   --duracao S     duração do excerto, até 25 s (mais 5 s do cartão final)
 *   --sem-enviar    só grava o ficheiro na pasta trailers/, não o envia para a app
 *
 * O trailer fica em trailers/<serie>.mp4 e (sem --sem-enviar) é enviado para o armazenamento,
 * aparecendo no painel do artista com o botão "Descarregar trailer".
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.(".env");
} catch {}

const run = promisify(execFile);
const require = createRequire(import.meta.url);

function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const p = require("ffmpeg-static") as string | null;
    if (p && existsSync(p)) return p;
  } catch {}
  return "ffmpeg";
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  // Carregar depois do .env, para a marca e o armazenamento lerem as variáveis certas
  const { brand, artistLink } = await import("../config/brand");
  const storage = await import("../src/domain/storage/core");
  const { buildTrailerArgs, chooseClip, parseProbe } = await import("../src/domain/trailer");
  const { renderTrailerImages } = await import("../src/domain/trailer-images");

  const target = process.argv[2];
  if (!target || target.startsWith("--")) {
    console.log("Uso: npm run trailer -- <link-da-serie | todas> [--episodio 1] [--inicio 0] [--duracao 25] [--sem-enviar]");
    process.exit(1);
  }
  const epNumber = Number(arg("episodio") ?? 1);
  const startArg = Number(arg("inicio") ?? 0);
  const durArg = Math.min(25, Number(arg("duracao") ?? 25));
  const upload = !process.argv.includes("--sem-enviar");
  const ffmpeg = ffmpegPath();
  const db = new PrismaClient();

  const seriesList = await db.series.findMany({
    where: target === "todas" ? { status: "PUBLISHED", trailerKey: null } : { slug: target },
    include: { artist: true, episodes: { where: { number: epNumber } } },
  });
  if (seriesList.length === 0) {
    console.log(target === "todas" ? "Não há séries publicadas sem trailer." : `Série "${target}" não encontrada.`);
    await db.$disconnect();
    return;
  }

  mkdirSync("trailers", { recursive: true });
  for (const series of seriesList) {
    const ep = series.episodes[0];
    const key = ep?.videoKeyHd ?? ep?.videoKey;
    if (!key) {
      console.log(`- ${series.title}: o episódio ${epNumber} não tem vídeo. Ignorado.`);
      continue;
    }
    // Origem do vídeo: ficheiro de exemplo, ficheiro local, ou link temporário do armazenamento online
    let input: string;
    if (key.startsWith("/")) input = path.join("public", key);
    else if (storage.storageDriver() === "local") input = storage.localFilePath("media", key);
    else input = await storage.getObjectUrl("media", key, 3600);

    const probe = await run(ffmpeg, ["-hide_banner", "-i", input]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
    const info = parseProbe(probe.stderr ?? "");
    const { startSec, clipSec } = chooseClip(info.durationSec, startArg, durArg);

    const tmp = mkdtempSync(path.join(tmpdir(), "trailer-"));
    const images = renderTrailerImages(
      tmp,
      { brand: brand.name, title: series.title, restIn: "O resto está em", linkLine: `link na bio · ${artistLink(series.artist.slug)}` },
      { background: brand.colors.background, text: brand.colors.text, accent: brand.colors.accent, accent2: brand.colors.accent2 },
    );

    const output = path.join("trailers", `${series.slug}.mp4`);
    const args = buildTrailerArgs({
      input,
      output,
      startSec,
      clipSec,
      endCardSec: 5,
      hasAudio: info.hasAudio,
      ...images,
    });
    process.stdout.write(`- ${series.title}: a gerar (${clipSec}s + 5s)… `);
    await run(ffmpeg, args, { maxBuffer: 20 * 1024 * 1024 });
    console.log(`feito → ${output}`);

    if (upload) {
      const storageKey = storage.newKey(`trailers/${series.id}`, "mp4");
      await storage.putObject("media", storageKey, readFileSync(output), "video/mp4");
      await db.series.update({ where: { id: series.id }, data: { trailerKey: storageKey, trailerUpdatedAt: new Date() } });
      await db.notification.create({
        data: {
          userId: series.artist.userId,
          title: "O teu trailer está pronto",
          body: `Descarrega o trailer de "${series.title}" e publica no TikTok e no Instagram.`,
          link: "/artista",
        },
      });
      console.log(`  enviado para a app e o artista foi avisado.`);
    }
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
