import type { ScopedTx } from "./scoped-prisma";

/** بيولّد رقم أمر شراء آمن ضد التزامن (advisory lock + عدّاد سنوي) — لازم تتنادى جوه transaction
 * سكوبد بالفعل. كانت النسخة دي متكررة بالحرف في 3 أماكن (createPurchaseOrder المباشر،
 * createEntityFromChangeRequest's "PurchaseOrder" case، وقبول عروض فوق السقف في
 * approvals/actions.ts) — نفس فئة nextEntryNumber في src/lib/accounting.ts (ترقيم آمن ضد
 * التزامن)، اتصلحت بمراجعة كود 8 سبتمبر. */
export async function generatePoNumber(tx: ScopedTx, orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`po-number-${orgId}-${year}`}))`;
  const countThisYear = await tx.purchaseOrder.count({ where: { orgId, poNumber: { startsWith: `PO-${year}-` } } });
  return `PO-${year}-${String(countThisYear + 1).padStart(4, "0")}`;
}
