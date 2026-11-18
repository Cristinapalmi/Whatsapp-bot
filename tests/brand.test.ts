import { describe, expect, it } from "vitest";
import { resolveDomain } from "@config/brand";

describe("Endereço do site", () => {
  it("um domínio próprio em NEXT_PUBLIC_BRAND_DOMAIN tem prioridade", () => {
    expect(resolveDomain({ NEXT_PUBLIC_BRAND_DOMAIN: "konta.ao", VERCEL_PROJECT_PRODUCTION_URL: "konta-app-iota.vercel.app" })).toBe("konta.ao");
    expect(resolveDomain({ NEXT_PUBLIC_BRAND_DOMAIN: "https://www.konta.ao/" })).toBe("www.konta.ao");
  });
  it("um *.vercel.app errado é substituído pelo endereço real de produção da Vercel", () => {
    expect(resolveDomain({ NEXT_PUBLIC_BRAND_DOMAIN: "konta-app.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "konta-app-iota.vercel.app" })).toBe("konta-app-iota.vercel.app");
  });
  it("sem NEXT_PUBLIC_BRAND_DOMAIN usa o endereço da Vercel", () => {
    expect(resolveDomain({ VERCEL_PROJECT_PRODUCTION_URL: "konta-app-iota.vercel.app" })).toBe("konta-app-iota.vercel.app");
    expect(resolveDomain({ NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "konta-app-iota.vercel.app" })).toBe("konta-app-iota.vercel.app");
  });
  it("no computador (sem Vercel) usa o valor configurado ou localhost", () => {
    expect(resolveDomain({ NEXT_PUBLIC_BRAND_DOMAIN: "localhost:3000" })).toBe("localhost:3000");
    expect(resolveDomain({ NEXT_PUBLIC_BRAND_DOMAIN: "konta-app.vercel.app" })).toBe("konta-app.vercel.app");
    expect(resolveDomain({})).toBe("localhost:3000");
  });
});

describe("Banner: duração do MP4 lida no servidor", () => {
  it("lê a duração de um MP4 real e recusa ficheiros que não são MP4", async () => {
    const { mp4DurationSec } = await import("@/domain/banner");
    const fs = await import("node:fs");
    const path = "public/samples/demo-360.mp4";
    if (fs.existsSync(path)) {
      const d = mp4DurationSec(fs.readFileSync(path));
      expect(d).toBeGreaterThan(1);
      expect(d).toBeLessThan(600);
    }
    expect(mp4DurationSec(Buffer.from("isto não é um vídeo"))).toBeNull();
  });
  it("o botão do banner só leva a destinos internos", async () => {
    const { ctaHref } = await import("@/domain/banner");
    expect(ctaHref({ ctaKind: "SERIES", ctaTarget: "a-serie" })).toBe("/serie/a-serie");
    expect(ctaHref({ ctaKind: "CREATORS", ctaTarget: null })).toBe("/criadores");
    expect(ctaHref({ ctaKind: "STORE", ctaTarget: null })).toBe("/loja");
    expect(ctaHref({ ctaKind: "LINK", ctaTarget: "/ranking" })).toBe("/ranking");
    expect(ctaHref({ ctaKind: "LINK", ctaTarget: "//mau.com" })).toBeNull();
    expect(ctaHref({ ctaKind: "LINK", ctaTarget: "https://mau.com" })).toBeNull();
  });
});
