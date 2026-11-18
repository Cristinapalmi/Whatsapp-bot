import Link from "next/link";
import { brand } from "@config/brand";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { IconBell, IconCoin } from "./icons";
import { coinBalance } from "@/domain/coins/service";

export async function Header() {
  const user = await getCurrentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const coins = user ? await coinBalance(db, user.id) : 0;
  return (
    <header className="print:hidden sticky top-0 z-30 border-b border-white/5 bg-bg/90 backdrop-blur">
      <div className="container-app flex h-14 items-center justify-between gap-3">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight text-accent no-underline">
          {brand.name}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="btn-ghost btn-sm hidden md:inline-flex">Início</Link>
          <Link href="/membro" className="btn-ghost btn-sm hidden md:inline-flex">Membro</Link>
          <Link href="/lista" className="btn-ghost btn-sm hidden md:inline-flex">A minha lista</Link>
          {user?.role === "ARTIST" && <Link href="/artista" className="btn-secondary btn-sm">Painel<span className="hidden md:inline">&nbsp;do artista</span></Link>}
          {user?.role === "ADMIN" && <Link href="/admin" className="btn-secondary btn-sm">Admin</Link>}
          <Link href="/loja" className="btn-ghost btn-sm gap-1 font-semibold text-accent2" aria-label={user ? `Loja — tens ${coins} moedas` : "Loja de moedas"}>
            <IconCoin size={20} /> {user ? coins.toLocaleString("pt-AO") : <span className="hidden sm:inline">Loja</span>}
          </Link>
          {user ? (
            <>
              <Link href="/conta/notificacoes" className="btn-ghost btn-sm relative" aria-label={`Notificações${unread ? ` (${unread} por ler)` : ""}`}>
                <IconBell />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 min-w-5 rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-5 text-[#1A0E05]">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/conta" className="btn-ghost btn-sm hidden md:inline-flex">A minha conta</Link>
            </>
          ) : (
            <Link href="/entrar" className="btn-primary btn-sm">Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
