import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import DecisionForm from "./DecisionForm";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

type QuoteOverridePayload = {
  scenarioId: string;
  dealId: string;
  unitPrice: number;
  priceUnit: string;
  currency: string;
  walkAwayPrice: string;
};

type GateWaiverPayload = {
  dealId: string;
  complianceCaseId: string;
  gateName: string;
};

type PurchaseOrderOverridePayload = {
  sourcingRequestId: string;
  dealId: string;
  unitPrice: number;
  currency: string;
  maximumPurchasePrice: string;
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Approval", "Approve");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          معندكش صلاحية اعتماد الموافقات — متاحة لـSalesManager/Finance/Admin/CompanyOwner بس.
        </div>
      </main>
    );
  }

  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);
  // ⚠️ مش Promise.all — كل استعلام من getScopedPrisma() بيفتح transaction لوحده (لازمة RLS)،
  // والتنفيذ بالتوازي بيتزاحم على اتصال الـpool ويفشل بـP2028. راجع BACKLOG.md.
  const pending = await prisma.approval.findMany({
    where: { orgId, decision: "Pending" },
    include: { requestedByUser: true },
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const totalPending = await prisma.approval.count({ where: { orgId, decision: "Pending" } });
  const totalPendingPages = Math.max(1, Math.ceil(totalPending / PAGE_SIZE));
  const decided = await prisma.approval.findMany({
    where: { orgId, decision: { in: ["Approved", "Rejected"] } },
    include: { requestedByUser: true, decidedByUser: true },
    orderBy: { decidedAt: "desc" },
    take: 20,
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">الموافقات الاستثنائية</h1>
      <p className="mt-1 text-sm text-neutral-500">
        طلبات تجاوز استثنائية (سعر تحت walkAwayPrice، أو بوابة امتثال Waived) — الـTrigger على
        مستوى القاعدة مش هيسمح بالتنفيذ إلا بعد اعتماد الطلب هنا.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-neutral-900">قيد الانتظار ({totalPending})</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">لا يوجد طلبات معلّقة.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {pending.map((a) => {
              const isGateWaiver = a.subjectType === "Gate.waiver";
              const isPoOverride = a.subjectType === "PurchaseOrder.unitPrice_override";
              const quoteP = a.payload as unknown as QuoteOverridePayload;
              const gateP = a.payload as unknown as GateWaiverPayload;
              const poP = a.payload as unknown as PurchaseOrderOverridePayload;
              const dealId = isGateWaiver ? gateP.dealId : isPoOverride ? poP.dealId : quoteP.dealId;
              return (
                <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-900">
                      طلب بواسطة {a.requestedByUser.fullName}
                      {isGateWaiver && " — تجاوز بوابة امتثال"}
                      {isPoOverride && " — تجاوز الحد الأقصى لسعر الشراء"}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {a.createdAt.toLocaleString("ar-EG")}
                    </span>
                  </div>
                  {isGateWaiver ? (
                    <p className="mt-2 text-sm text-neutral-800">
                      طلب تجاوز بوابة &quot;{gateP.gateName}&quot; بلا استيفاء متطلباتها الحاجبة.
                    </p>
                  ) : isPoOverride ? (
                    <p className="mt-2 font-mono text-sm text-neutral-800">
                      سعر الشراء المطلوب: {poP.unitPrice} {poP.currency} — الحد الأقصى المسموح:{" "}
                      {poP.maximumPurchasePrice} {poP.currency}
                    </p>
                  ) : (
                    <p className="mt-2 font-mono text-sm text-neutral-800">
                      السعر المطلوب: {quoteP.unitPrice} {quoteP.currency} / {quoteP.priceUnit} — الحد الأدنى:{" "}
                      {quoteP.walkAwayPrice} {quoteP.currency}
                    </p>
                  )}
                  <DecisionForm approvalId={a.id} dealId={dealId} />
                </div>
              );
            })}
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPendingPages} basePath="/approvals" />
      </section>

      {decided.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-neutral-900">آخر القرارات</h2>
          <div className="mt-3 flex flex-col gap-2">
            {decided.map((a) => (
              <div key={a.id} className="rounded-lg border border-neutral-200 px-4 py-3 text-sm">
                <span
                  className={a.decision === "Approved" ? "text-emerald-700" : "text-rose-700"}
                >
                  {a.decision === "Approved" ? "اتوافق عليه" : "اترفض"}
                </span>{" "}
                بواسطة {a.decidedByUser?.fullName} — {a.reason}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
