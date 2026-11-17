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
