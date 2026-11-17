"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { error?: string; ok?: string } | null;
type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/** Formulário que mostra erros/sucesso e desativa o botão enquanto envia. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/15 px-4 py-3 text-sm text-danger">{state.error}</p>
      )}
      {state?.ok && (
        <p role="status" className="mt-3 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">{state.ok}</p>
      )}
    </form>
  );
}

export function SubmitButton({ children, className = "btn-primary w-full", pendingText = "A enviar…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
