"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavoriteAction } from "@/app/lista/actions";
import { IconBookmark, IconCheck } from "./icons";

export function FavoriteButton({ seriesId, initial, next }: { seriesId: string; initial: boolean; next: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={saved}
      onClick={() =>
        start(async () => {
          const r = await toggleFavoriteAction(seriesId);
          if (r.login) router.push(`/entrar?next=${encodeURIComponent(next)}`);
          else if (r.ok) setSaved(!!r.saved);
        })
      }
      className={saved ? "btn-secondary" : "btn-ghost border border-white/15"}
    >
      {saved ? <IconCheck size={18} /> : <IconBookmark size={18} />} {saved ? "Na minha lista" : "A minha lista"}
    </button>
  );
}
