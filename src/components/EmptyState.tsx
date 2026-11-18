import Link from "next/link";
import { IconSparkle } from "./icons";

/** Mensagem simpática quando ainda não há dados, com um botão útil. */
export function EmptyState({ title, text, action, icon }: { title: string; text: string; action?: { href: string; label: string }; icon?: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-surface/60 px-5 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">{icon ?? <IconSparkle size={24} />}</span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <Link href={action.href} className="btn-primary btn-sm mt-4 no-underline">{action.label}</Link>}
    </div>
  );
}
