import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser("/conta/notificacoes");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  // Abrir a página marca tudo como lido
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return (
    <div className="container-app max-w-2xl">
      <h1 className="text-2xl font-bold">Notificações</h1>
      {items.length === 0 && <p className="mt-4 text-muted">Sem notificações.</p>}
      <ul className="mt-4 space-y-2">
        {items.map((n) => (
          <li key={n.id} className={`card ${n.readAt ? "" : "ring-1 ring-accent/50"}`}>
            <p className="font-semibold">{n.title}</p>
            <p className="text-sm text-fg/90">{n.body}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>{formatDateTime(n.createdAt)}</span>
              {n.link && <Link href={n.link} className="font-semibold text-accent2 underline">Abrir</Link>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
