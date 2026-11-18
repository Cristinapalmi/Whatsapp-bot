import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCodes, hashRecoveryCode, totpAt, verifyTotp } from "@/lib/totp";

// Segredo de teste do RFC 6238 (SHA1): "12345678901234567890"
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("Autenticação em 2 passos (TOTP)", () => {
  it("dá os códigos oficiais do RFC 6238", () => {
    expect(totpAt(SECRET, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(totpAt(SECRET, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(totpAt(SECRET, Math.floor(1234567890 / 30), 8)).toBe("89005924");
    expect(base32Decode(SECRET).toString()).toBe("12345678901234567890");
  });

  it("aceita o código atual (±30 s) e recusa códigos errados ou repetidos", () => {
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30000);
    const code = totpAt(SECRET, step);
    expect(verifyTotp(SECRET, code, { now })).toBe(step);
    expect(verifyTotp(SECRET, totpAt(SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(SECRET, totpAt(SECRET, step - 3), { now })).toBeNull();
    expect(verifyTotp(SECRET, "000000", { now })).toBeNull();
    expect(verifyTotp(SECRET, "12ab56", { now })).toBeNull();
    expect(verifyTotp(SECRET, code, { now, lastStep: step })).toBeNull(); // não reutiliza
  });

  it("códigos de recuperação: guardados só como hash", () => {
    const { codes, hashes } = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(hashes[0]).toBe(hashRecoveryCode(codes[0].toLowerCase()));
    expect(hashes[0]).not.toContain(codes[0]);
  });
});
