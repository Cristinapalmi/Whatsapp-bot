"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { error?: string; ok?: string } | null;
type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const PendingContext = createContext(false);

/**
 * Formulário que mostra erros/sucesso e desativa o botão enquanto envia.
 * Não apaga o que já foi preenchido quando há um erro (só limpa se `resetOnSuccess` e correu bem).
 */
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
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <PendingContext.Provider value={pending}>
      <form
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const fd = new FormData(e.currentTarget, submitter ?? undefined);
          startTransition(() => formAction(fd));
        }}
      >
        {children}
        {state?.error && (
          <p role="alert" className="col-span-full mt-3 rounded-xl bg-danger/15 px-4 py-3 text-sm text-danger">{state.error}</p>
        )}
        {state?.ok && (
          <p role="status" className="col-span-full mt-3 rounded-xl bg-ok/15 px-4 py-3 text-sm text-ok">{state.ok}</p>
        )}
      </form>
    </PendingContext.Provider>
  );
}

export function SubmitButton({ children, className = "btn-primary w-full", pendingText = "A enviar…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const status = useFormStatus();
  const pending = useContext(PendingContext) || status.pending;
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
