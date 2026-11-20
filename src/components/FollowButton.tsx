"use client";
import { askLogin } from "@/lib/ask-login";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFollowAction } from "@/app/seguir/actions";

/** Botão "Seguir" — quem segue recebe aviso de séries e episódios novos. */
export function FollowButton({ artistId, initial, count, next }: { artistId: string; initial: boolean; count: number; next: string }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [n, setN] = useState(count);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={following ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
        onClick={() =>
          start(async () => {
            const r = await toggleFollowAction(artistId);
            if (r.login) askLogin(next);
            else if (r.ok) {
              setFollowing(!!r.following);
              setN((x) => x + (r.following ? 1 : -1));
            }
          })
        }
      >
        {following ? "A seguir ✓" : "Seguir"}
      </button>
      <span className="text-sm text-muted"><strong className="text-fg">{n.toLocaleString("pt-AO")}</strong> {n === 1 ? "seguidor" : "seguidores"}</span>
    </div>
  );
}
