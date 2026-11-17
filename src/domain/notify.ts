import type { Prisma } from "@prisma/client";
import type { Tx } from "./money/ledger";

export function notify(tx: Tx, userId: string, title: string, body: string, link?: string) {
  return tx.notification.create({ data: { userId, title, body, link } });
}

export function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  data?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({ data: { actorId, action, targetType, targetId, data } });
}
