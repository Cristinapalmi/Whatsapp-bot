"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { quickLoginAction, quickRegisterAction } from "@/app/entrar/quick-actions";
import { IconX } from "./icons";

/**
 * JANELA DE ENTRADA (sobe de baixo, por cima da página atual).
 * Abre-se: em links para /entrar, em episódios (/ver/…) sem sessão, e quando um componente chama askLogin().
 * Depois de entrar ou criar conta, continua onde estava (ex.: começa a tocar o episódio escolhido).
 */
function AuthSheetInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [next, setNext] = useState("/");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const loggedIn = useRef<boolean | null>(null);

  const show = useCallback((n?: string, m: "register" | "login" = "register") => {
    setNext(n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
    setMode(m);
    setError(null);
    setOpen(true);
  }, []);

  // Sabe se há sessão (e limpa sessões expiradas sem mensagem)
  useEffect(() => {
    fetch("/api/sessao", { cache: "no-store" }).then((r) => r.json()).then((d) => { loggedIn.current = !!d.loggedIn; }).catch(() => {});
  }, [pathname]);

  // ?entrar=1&next=… (vindo de uma página que precisa de conta)
  useEffect(() => {
    if (params.get("entrar") === "1") show(params.get("next") ?? "/", params.get("modo") === "entrar" ? "login" : "register");
  }, [params, show]);

  // Pedidos vindos de componentes (askLogin)
  useEffect(() => {
    const w = window as Window & { __kontaAuth?: string };
    const onAsk = (e: Event) => { w.__kontaAuth = undefined; show((e as CustomEvent).detail?.next); };
    // pedido feito antes de a janela estar pronta
    if (w.__kontaAuth) { show(w.__kontaAuth); w.__kontaAuth = undefined; }
    window.addEventListener("konta:auth", onAsk);
    return () => window.removeEventListener("konta:auth", onAsk);
  }, [show]);

  // Cliques em "Entrar" e em episódios sem sessão: abre a janela em vez de mudar de página
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || !a.getAttribute("href")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === "/entrar" || url.pathname === "/registar") {
        e.preventDefault();
        // "Entrar" do topo/barra de baixo → entrar; ações que precisam de conta (com next) → criar conta
        const nx = url.searchParams.get("next");
        show(nx ?? window.location.pathname + window.location.search, url.pathname === "/entrar" && !nx ? "login" : "register");
      } else if (url.pathname.startsWith("/ver/") && loggedIn.current === false) {
        e.preventDefault();
        show(url.pathname);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [show]);

  const close = () => {
    setOpen(false);
    if (params.get("entrar") === "1") router.replace(pathname);
  };

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      fd.set("next", next);
      const r = mode === "login" ? await quickLoginAction(fd) : await quickRegisterAction(fd);
      if (!r.ok) return setError(r.error);
      loggedIn.current = true;
      setOpen(false);
      if (r.fullReload) window.location.href = r.next;
      else {
        router.replace(r.next);
        router.refresh();
      }
    });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={mode === "login" ? "Entrar" : "Criar conta"} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-accent/30 bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_-10px_rgb(var(--c-accent)/0.5)] animate-[sheetup_.28s_ease-out]">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold leading-tight">
            {mode === "register" ? "Cria a tua conta grátis e vê já os 3 primeiros episódios" : "Entra na tua conta"}
          </h2>
          <button type="button" onClick={close} className="btn-ghost btn-sm -mr-2" aria-label="Fechar"><IconX size={20} /></button>
        </div>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Não preencher<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div>
            <label className="label" htmlFor="as-phone">Telefone</label>
            <input className="input" id="as-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="923 456 789" required />
          </div>
          <div>
            <label className="label" htmlFor="as-pw">Palavra-passe{mode === "register" ? " (mín. 8 caracteres)" : ""}</label>
            <input className="input" id="as-pw" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 1} required />
          </div>
          {mode === "register" && (
            <>
              <div>
                <label className="label" htmlFor="as-birth">Data de nascimento</label>
                <input className="input" id="as-birth" name="birthDate" type="date" required />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="terms" required className="checkbox mt-0.5" />
                <span>Aceito os <Link href="/legal/termos" target="_blank" className="text-accent2 underline">Termos</Link> e a <Link href="/legal/privacidade" target="_blank" className="text-accent2 underline">Política de Privacidade</Link>.</span>
              </label>
            </>
          )}
          {error && <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={pending} className="btn-glow w-full rounded-full text-base font-extrabold">
            {pending ? "Um momento…" : mode === "register" ? "Criar conta grátis" : "Entrar"}
          </button>
        </form>
        <button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(null); }} className="btn-ghost mt-2 w-full text-sm">
          {mode === "register" ? <>Já tenho conta — <strong className="ml-1 text-accent2">Entrar</strong></> : <>Ainda não tenho conta — <strong className="ml-1 text-accent2">Criar conta grátis</strong></>}
        </button>
      </div>
    </div>
  );
}

export function AuthSheet() {
  return (
    <Suspense fallback={null}>
      <AuthSheetInner />
    </Suspense>
  );
}
