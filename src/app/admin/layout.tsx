import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewCount } from "@/domain/series-workflow";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [payments, payouts, artists, review, reports] = await Promise.all([
    db.paymentRequest.count({ where: { status: "PENDING" } }),
    db.payoutRequest.count({ where: { status: "PROCESSING" } }),
    db.artistProfile.count({ where: { status: "PENDING" } }),
    reviewCount(db),
    db.report.count({ where: { status: "OPEN" } }),
  ]);
  const links: [string, string, number][] = [
    ["/admin", "Resumo", 0],
    ["/admin/revisao", "Revisão", review],
    ["/admin/pagamentos", "Pagamentos", payments],
    ["/admin/levantamentos", "Levantamentos", payouts],
    ["/admin/financeiro", "Financeiro", 0],
    ["/admin/moedas", "Moedas", 0],
    ["/admin/anuncios", "Anúncios", 0],
    ["/admin/artistas", "Artistas", artists],
    ["/admin/series", "Séries", 0],
    ["/admin/denuncias", "Denúncias", reports],
    ["/admin/exportacoes", "Exportações", 0],
  ];
  return (
    <div className="container-app">
      <nav aria-label="Administração" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-3">
        {links.map(([href, label, n]) => (
          <Link key={href} href={href} className="btn-secondary btn-sm shrink-0 no-underline">
            {label}
            {n > 0 && <span className="rounded-full bg-accent px-2 text-xs font-bold text-[#1A0E05]">{n}</span>}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
