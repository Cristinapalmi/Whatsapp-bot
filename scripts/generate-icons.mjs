// Gera os ícones da app (public/icons/icon-192.png e icon-512.png) com a inicial da marca.
// Uso: node scripts/generate-icons.mjs "NOME" "#FF7A2F" "#0E0D0C"
// Requer o Playwright (npx playwright install chromium, se ainda não tiveres).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync } from "node:fs";

const name = process.argv[2] ?? process.env.NEXT_PUBLIC_BRAND_NAME ?? "KONTA";
const accent = process.argv[3] ?? process.env.NEXT_PUBLIC_BRAND_COLOR_ACCENT ?? "#FF7A2F";
const bg = process.argv[4] ?? "#0E0D0C";
const letter = name.trim()[0]?.toUpperCase() ?? "K";

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:${bg}">
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg}">
      <div style="width:${size * 0.8}px;height:${size * 0.8}px;border-radius:${size * 0.2}px;background:${accent};display:flex;align-items:center;justify-content:center;
        font:900 ${size * 0.55}px Arial Black, Arial, sans-serif;color:#1A0E05">${letter}</div></div></body></html>`);
  await page.screenshot({ path: `public/icons/icon-${size}.png` });
  await page.close();
}
await browser.close();
console.log("Ícones gerados para", name);
