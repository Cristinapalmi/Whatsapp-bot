/**
 * Desenha as imagens com texto do trailer (só no computador, via script — não na app web).
 * Usa a fonte Bricolage Grotesque incluída em assets/fonts (licença OFL).
 */
import path from "node:path";
import { writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import type { TrailerTexts } from "./trailer";

type Colors = { background: string; text: string; accent: string; accent2: string };

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  GlobalFonts.registerFromPath(path.resolve("assets/fonts/BricolageGrotesque_800ExtraBold.ttf"), "TrailerBold");
  GlobalFonts.registerFromPath(path.resolve("assets/fonts/BricolageGrotesque_500Medium.ttf"), "TrailerMedium");
  fontsReady = true;
}

/** Escreve texto centrado, reduzindo o tamanho até caber na largura. */
function centered(ctx: SKRSContext2D, text: string, y: number, family: string, size: number, color: string, maxW: number, W: number) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 18) {
    s -= 2;
    ctx.font = `${s}px ${family}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, W / 2, y);
}

export function renderTrailerImages(dir: string, texts: TrailerTexts, colors: Colors, W = 720, H = 1280) {
  registerFonts();
  const margin = 48;

  // Faixa do topo (transparente), com o nome da marca
  const banner = createCanvas(W, 150);
  const b = banner.getContext("2d");
  const grad = b.createLinearGradient(0, 0, 0, 150);
  grad.addColorStop(0, "rgba(0,0,0,0.65)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  b.fillStyle = grad;
  b.fillRect(0, 0, W, 150);
  b.font = "54px TrailerBold";
  b.fillStyle = colors.accent;
  b.textBaseline = "top";
  b.fillText(texts.brand, 40, 36);
  const bannerPng = path.join(dir, "banner.png");
  writeFileSync(bannerPng, banner.toBuffer("image/png"));

  // Cartão final
  const card = createCanvas(W, H);
  const c = card.getContext("2d");
  c.fillStyle = colors.background;
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W * 0.7, H * 0.2, 10, W * 0.7, H * 0.2, W);
  glow.addColorStop(0, `${colors.accent2}40`);
  glow.addColorStop(1, `${colors.accent2}00`);
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  c.fillStyle = colors.accent;
  c.fillRect((W - 160) / 2, H * 0.3, 160, 10);
  centered(c, texts.title, H * 0.38, "TrailerMedium", 44, colors.text, W - margin * 2, W);
  centered(c, texts.restIn, H * 0.48, "TrailerMedium", 58, colors.text, W - margin * 2, W);
  centered(c, texts.brand, H * 0.48 + 130, "TrailerBold", 130, colors.accent, W - margin * 2, W);
  centered(c, texts.linkLine, H * 0.48 + 220, "TrailerBold", 40, colors.accent2, W - margin * 2, W);
  const endCardPng = path.join(dir, "endcard.png");
  writeFileSync(endCardPng, card.toBuffer("image/png"));

  return { bannerPng, endCardPng };
}
