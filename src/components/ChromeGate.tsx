"use client";
import { usePathname } from "next/navigation";

/** Esconde o cabeçalho e a barra de baixo enquanto se vê um episódio (leitor em ecrã inteiro). */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/ver/")) return null;
  return <>{children}</>;
}
