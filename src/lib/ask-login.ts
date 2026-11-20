/** Pede para entrar/criar conta SEM sair da página: abre a janela que sobe de baixo. */
export function askLogin(next?: string) {
  if (typeof window === "undefined") return;
  const n = next ?? window.location.pathname + window.location.search;
  // Fica guardado caso a janela ainda não esteja pronta a ouvir (ex.: logo ao abrir a página)
  (window as Window & { __kontaAuth?: string }).__kontaAuth = n;
  window.dispatchEvent(new CustomEvent("konta:auth", { detail: { next: n } }));
}
