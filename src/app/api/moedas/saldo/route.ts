import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { coinBalance } from "@/domain/coins/service";

/** Saldo de moedas e compras pendentes — o painel de desbloqueio pergunta de vez em quando. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ balance: 0, pending: 0 }, { headers: { "Cache-Control": "no-store" } });
  const [balance, pending] = await Promise.all([
    coinBalance(db, user.id),
    db.paymentRequest.count({ where: { userId: user.id, kind: "COINS", status: "PENDING" } }),
  ]);
  return NextResponse.json({ balance, pending }, { headers: { "Cache-Control": "no-store" } });
}
