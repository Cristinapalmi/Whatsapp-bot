// Gera capas SVG simples para as séries de exemplo (public/covers/*.svg).
import { writeFileSync, mkdirSync } from "node:fs";

const covers = [
  ["a-kianda-do-mussulo", "A Kianda do Mussulo", "#0B3D4A", "#04141A", "TERROR"],
  ["as-makas-da-tia-bela", "As Makas da Tia Bela", "#B8457A", "#3A0F25", "COMÉDIA"],
  ["o-candongueiro-assombrado", "O Candongueiro Assombrado", "#2B4A8C", "#0A1022", "TERROR"],
  ["traicao-no-kilamba", "Traição no Kilamba", "#8C2B2B", "#220A0A", "DRAMA"],
  ["o-kudurista-falido", "O Kudurista Falido", "#C98A1B", "#3A2405", "COMÉDIA"],
  ["a-heranca-do-avo-kitoko", "A Herança do Avô Kitoko", "#3F7A3A", "#0F220D", "MAKAS DE FAMÍLIA"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function wrap(title) {
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 13) { lines.push(cur.trim()); cur = w; } else cur += " " + w;
  }
  lines.push(cur.trim());
  return lines;
}

mkdirSync("public/covers", { recursive: true });
for (const [slug, title, c1, c2, tag] of covers) {
  const lines = wrap(title);
  const startY = 900 - 120 - lines.length * 74;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<radialGradient id="r" cx="0.7" cy="0.25" r="0.6"><stop offset="0" stop-color="#FFB547" stop-opacity="0.35"/><stop offset="1" stop-color="#FFB547" stop-opacity="0"/></radialGradient></defs>
<rect width="600" height="900" fill="url(#g)"/><rect width="600" height="900" fill="url(#r)"/>
<circle cx="420" cy="230" r="120" fill="none" stroke="#FF7A2F" stroke-opacity="0.5" stroke-width="6"/>
<text x="48" y="${startY - 30}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#FFB547" letter-spacing="4">${esc(tag)}</text>
${lines.map((l, i) => `<text x="48" y="${startY + 60 + i * 74}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="66" font-weight="900" fill="#F6F2EE">${esc(l)}</text>`).join("\n")}
<rect x="48" y="${900 - 90}" width="120" height="8" rx="4" fill="#FF7A2F"/>
</svg>`;
  writeFileSync(`public/covers/${slug}.svg`, svg);
}
console.log("Capas geradas:", covers.length);
