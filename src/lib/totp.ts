import crypto from "node:crypto";

/**
 * AUTENTICAÇÃO EM 2 PASSOS (TOTP, RFC 6238) — compatível com Google Authenticator,
 * Microsoft Authenticator, Authy, 1Password, etc. Códigos de 6 dígitos, a cada 30 segundos.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Código base32 inválido");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export function totpAt(secretBase32: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = h[h.length - 1] & 0xf;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / 30);

/**
 * Verifica um código (aceita 1 passo antes/depois, por causa de relógios desacertados).
 * Devolve o passo usado (para impedir reutilizar o mesmo código) ou null.
 */
export function verifyTotp(secretBase32: string, code: string, opts: { now?: number; lastStep?: number | null } = {}): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(opts.now);
  for (const s of [step, step - 1, step + 1]) {
    if (opts.lastStep != null && s <= opts.lastStep) continue; // já usado
    const expected = totpAt(secretBase32, s);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return s;
  }
  return null;
}

export function otpauthUri(secret: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Códigos de recuperação (para quando se perde o telemóvel). Guarda-se só o hash. */
export function generateRecoveryCodes(n = 8) {
  const codes = Array.from({ length: n }, () => {
    const raw = base32Encode(crypto.randomBytes(6)).slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashRecoveryCode) };
}
export const hashRecoveryCode = (code: string) => crypto.createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex");
