import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";

/** A app nunca abre nesta página: vai para o Início com a janela de entrada por cima. */
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  redirect(`/?entrar=1&modo=registar${safe ? `&next=${encodeURIComponent(safe)}` : ""}`);
}
