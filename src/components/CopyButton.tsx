"use client";
import { useState } from "react";
import { IconCheck, IconCopy } from "./icons";

export function CopyButton({ text, label = "Copiar", showText, buttonText = "Copiar" }: { text: string; label?: string; showText?: boolean; buttonText?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={showText ? "btn-secondary" : "btn-ghost btn-sm"}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? <IconCheck size={18} /> : <IconCopy size={18} />}
      {showText && (done ? "Copiado" : buttonText)}
    </button>
  );
}
