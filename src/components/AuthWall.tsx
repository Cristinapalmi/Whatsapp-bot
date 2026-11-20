"use client";
import Link from "next/link";
import { useEffect } from "react";
import { askLogin } from "@/lib/ask-login";
import { IconChevronLeft, IconLock } from "./icons";

/** Episódio aberto sem conta: capa da série por trás e a janela de criar conta por cima. */
export function AuthWall({ next, title, episode, coverUrl, backHref }: { next: string; title: string; episode: number; coverUrl: string | null; backHref: string }) {
  useEffect(() => { askLogin(next); }, [next]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-60" />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/80" />
      <div className="relative w-full max-w-lg p-4">
        <Link href={backHref} className="btn-ghost btn-sm -ml-2 text-white no-underline"><IconChevronLeft size={18} /> Voltar à série</Link>
        <p className="mt-6 font-display text-3xl font-extrabold text-white drop-shadow">{title}</p>
        <p className="mt-1 text-white/85">Episódio {episode}</p>
        <button type="button" onClick={() => askLogin(next)} className="btn-glow mt-5 rounded-full font-extrabold"><IconLock size={18} /> Criar conta grátis para ver</button>
      </div>
    </div>
  );
}
