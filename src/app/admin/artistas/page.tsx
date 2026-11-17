import Link from "next/link";
import type { Metadata } from "next";
import type { ArtistStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { CATEGORY_LABELS } from "@/lib/categories";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { reviewArtistAction } from "../actions";

export const metadata: Metadata = { title: "Artistas" };

const TABS: [ArtistStatus, string][] = [["PENDING", "Pendentes"], ["APPROVED", "Aprovados"], ["REJECTED", "Rejeitados"], ["SUSPENDED", "Suspensos"]];

export default async function AdminArtists({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const status = (TABS.find(([s]) => s === estado)?.[0] ?? "PENDING") as ArtistStatus;
  const artists = await db.artistProfile.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { phone: true, birthDate: true, consents: { where: { document: { in: ["ARTIST_SHOW_SERIES", "ARTIST_FREE_EPISODES", "ARTIST_REVENUE_SPLIT", "ARTIST_CONTENT_RULES", "ARTIST_WITHDRAWAL_RULES"] } } } } } },
  });
  const photos = await Promise.all(artists.map((a) => mediaUrl(a.photoKey)));

  return (
    <div>
      <h1 className="text-2xl font-bold">Artistas</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([s, label]) => (
          <Link key={s} href={`/admin/artistas?estado=${s}`} className={s === status ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{label}</Link>
        ))}
      </div>
      {artists.length === 0 && <p className="mt-6 text-muted">Nada por aqui.</p>}
      <ul className="mt-4 space-y-4">
        {artists.map((a, i) => (
          <li key={a.id} className="card grid gap-4 sm:grid-cols-[96px_1fr]">
            <div className="h-24 w-24 overflow-hidden rounded-xl bg-surface2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photos[i] && <img src={photos[i]!} alt="" className="h-full w-full object-cover" />}
            </div>
            <div>
              <p className="text-lg font-bold">{a.stageName}</p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Nome</dt><dd>{a.fullName}</dd>
                <dt className="text-muted">BI</dt><dd className="font-mono">{a.biNumber}</dd>
                <dt className="text-muted">Telefone</dt><dd>{formatPhone(a.user.phone)}</dd>
                <dt className="text-muted">E-mail</dt><dd>{a.email}</dd>
                <dt className="text-muted">Redes</dt><dd><a href={a.socialUrl} target="_blank" rel="noreferrer" className="break-all text-accent2 underline">{a.socialUrl}</a></dd>
                <dt className="text-muted">Categoria</dt><dd>{CATEGORY_LABELS[a.category]}</dd>
                <dt className="text-muted">Link</dt><dd>/{a.slug}</dd>
                <dt className="text-muted">Registo</dt><dd>{formatDateTime(a.createdAt)}</dd>
                <dt className="text-muted">Política</dt>
                <dd>{a.user.consents.length}/5 caixas aceites{a.user.consents[0] ? ` · versão ${a.user.consents[0].version} · ${formatDateTime(a.user.consents[0].acceptedAt)}` : ""}</dd>
                {a.rejectionReason && <><dt className="text-muted">Motivo</dt><dd className="text-danger">{a.rejectionReason}</dd></>}
              </dl>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {a.status !== "APPROVED" && (
                  <ActionForm action={reviewArtistAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <SubmitButton className="btn-primary w-full">Aprovar</SubmitButton>
                  </ActionForm>
                )}
                <ActionForm action={reviewArtistAction} className="flex gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="decision" value={a.status === "APPROVED" ? "SUSPENDED" : "REJECTED"} />
                  <input name="reason" className="input" placeholder="Motivo" required minLength={3} />
                  <SubmitButton className="btn-danger">{a.status === "APPROVED" ? "Suspender" : "Rejeitar"}</SubmitButton>
                </ActionForm>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
