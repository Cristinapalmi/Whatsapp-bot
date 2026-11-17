import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteObject, getObjectUrl, getUploadUrl, putObject, resetStorageClientsForTests } from "@/domain/storage/core";

/**
 * Testa o "driver" do Supabase Storage com um servidor falso:
 * confirma que a app faz os pedidos certos (endereço, método, chave, bucket).
 */
type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
let calls: Call[] = [];

function fakeSupabase(url: string, init: RequestInit = {}) {
  const raw = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : ((init.headers ?? {}) as Record<string, string>);
  const headers = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]));
  calls.push({ url, method: init.method ?? "GET", headers, body: init.body });
  const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } }));
  const u = new URL(url);
  if (u.pathname.startsWith("/storage/v1/object/upload/sign/")) return json({ url: u.pathname.replace("/storage/v1", "") + "?token=UPTOKEN" });
  if (u.pathname.startsWith("/storage/v1/object/sign/")) return json({ signedURL: u.pathname.replace("/storage/v1", "") + "?token=GETTOKEN" });
  if (init.method === "DELETE") return json([]);
  return json({ Key: u.pathname, Id: "1" });
}

beforeEach(() => {
  calls = [];
  process.env.STORAGE_DRIVER = "supabase";
  process.env.SUPABASE_URL = "https://abc.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-secreta-teste";
  delete process.env.SUPABASE_BUCKET_MEDIA;
  delete process.env.SUPABASE_BUCKET_PRIVATE;
  resetStorageClientsForTests();
  vi.stubGlobal("fetch", vi.fn(fakeSupabase));
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env.STORAGE_DRIVER = "local";
  resetStorageClientsForTests();
});

describe("Supabase Storage", () => {
  it("guarda comprovativos no bucket privado com a chave secreta", async () => {
    await putObject("private", "proofs/2026/11/a.png", Buffer.from("x"), "image/png");
    const c = calls[0];
    expect(c.method).toBe("POST");
    expect(c.url).toBe("https://abc.supabase.co/storage/v1/object/privado/proofs/2026/11/a.png");
    expect(c.headers["content-type"]).toBe("image/png");
    expect(c.headers["x-upsert"]).toBe("false");
    expect(c.headers["authorization"] ?? c.headers["apikey"]).toContain("chave-secreta-teste");
  });

  it("cria links temporários para ver e para descarregar", async () => {
    const view = await getObjectUrl("media", "videos/s1/ep1.mp4", 3600);
    expect(calls[0].url).toBe("https://abc.supabase.co/storage/v1/object/sign/media/videos/s1/ep1.mp4");
    expect(JSON.parse(String(calls[0].body))).toEqual({ expiresIn: 3600 });
    expect(view).toBe("https://abc.supabase.co/storage/v1/object/sign/media/videos/s1/ep1.mp4?token=GETTOKEN");
    const dl = await getObjectUrl("media", "trailers/s1/t.mp4", 60, { downloadName: "trailer-x.mp4" });
    expect(dl).toContain("download=trailer-x.mp4");
  });

  it("cria o link de envio direto (vídeos do admin) sem expor a chave", async () => {
    const up = await getUploadUrl("media", "videos/s1/ep2.mp4", "video/mp4");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://abc.supabase.co/storage/v1/object/upload/sign/media/videos/s1/ep2.mp4");
    expect(up).toBe("https://abc.supabase.co/storage/v1/object/upload/sign/media/videos/s1/ep2.mp4?token=UPTOKEN");
    expect(up).not.toContain("chave-secreta");
  });

  it("respeita nomes de buckets personalizados e apaga ficheiros", async () => {
    process.env.SUPABASE_BUCKET_MEDIA = "minisseries-media";
    await deleteObject("media", "covers/x.jpg");
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toBe("https://abc.supabase.co/storage/v1/object/minisseries-media");
  });

  it("ficheiros de exemplo da pasta public não passam pelo Supabase", async () => {
    expect(await getObjectUrl("media", "/samples/demo-360.mp4")).toBe("/samples/demo-360.mp4");
    expect(calls).toHaveLength(0);
  });

  it("dá um erro claro quando faltam as variáveis", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetStorageClientsForTests();
    await expect(putObject("media", "a.txt", Buffer.from("x"), "text/plain")).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
