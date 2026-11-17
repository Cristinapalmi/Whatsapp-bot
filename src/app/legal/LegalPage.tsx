import { business } from "@config/business";

export function LegalPage({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <article className="container-app max-w-2xl py-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-sm text-muted">Versão {version}</p>
      <p className="mt-4 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
        Rascunho preparado para revisão por um jurista angolano antes da publicação definitiva.
      </p>
      {children}
    </article>
  );
}

export const v = business.legalVersions;
