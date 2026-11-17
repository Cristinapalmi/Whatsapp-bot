"use client";
import { useEffect } from "react";

/** Regista a visita ao link pessoal do artista (uma vez por página aberta). */
export function RefTracker({ slug }: { slug: string }) {
  useEffect(() => {
    fetch("/api/ref", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => {});
  }, [slug]);
  return null;
}
