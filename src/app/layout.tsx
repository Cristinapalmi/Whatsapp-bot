import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { brand, siteUrl } from "@config/brand";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { RegisterSW } from "@/components/RegisterSW";
import { SuggestionCard } from "@/components/SuggestionCard";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const text = Inter({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${brand.name} — ${brand.slogan}`, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: brand.colors.background,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** "#FF7A2F" → "255 122 47" (formato usado pelo Tailwind para permitir transparências). */
const rgb = (hex: string) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const vars = {
  "--c-bg": rgb(brand.colors.background),
  "--c-surface": rgb(brand.colors.surface),
  "--c-surface2": rgb(brand.colors.surface2),
  "--c-text": rgb(brand.colors.text),
  "--c-muted": rgb(brand.colors.muted),
  "--c-accent": rgb(brand.colors.accent),
  "--c-accent2": rgb(brand.colors.accent2),
} as CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" style={vars} className={`${display.variable} ${text.variable}`}>
      <body>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3">
          Saltar para o conteúdo
        </a>
        <Header />
        <main id="conteudo" className="pb-28 pt-2 md:pb-12">{children}</main>
        <BottomNav />
        <RegisterSW />
        <SuggestionCard />
      </body>
    </html>
  );
}
