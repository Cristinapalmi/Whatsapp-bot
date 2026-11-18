import Link from "next/link";
import { IconBookmark, IconCoin, IconCrown, IconHome, IconUser } from "./icons";
import { getCurrentUser } from "@/lib/auth";

/** Barra de navegação inferior (telemóvel). */
export async function BottomNav() {
  const user = await getCurrentUser();
  const item = "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted no-underline hover:text-fg";
  return (
    <nav aria-label="Navegação principal" className="print:hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="flex">
        <Link href="/" className={item}><IconHome />Início</Link>
        <Link href="/loja" className={item}><IconCoin />Loja</Link>
        <Link href="/membro" className={item}><IconCrown />Membro</Link>
        <Link href="/lista" className={item}><IconBookmark />Lista</Link>
        <Link href={user ? "/conta" : "/entrar"} className={item}><IconUser />{user ? "Conta" : "Entrar"}</Link>
      </div>
    </nav>
  );
}
