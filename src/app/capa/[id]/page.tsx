import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import StatusTransitionButtons from "./StatusTransitionButtons";
import { capaRootCauseMethodLabel, capaStatusLabel, capaStatusStyle, isCAPAOverdue } from "@/lib/capaLabels";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CAPADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "CAPA", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();
  const capa = await prisma.cAPA.findFirst({
    where: { id, orgId: user.orgId },
    include: { ownerUser: { select: { fullName: true } }, verifiedByUser: { select: { fullName: true } } },
  });
  if (!capa) notFound();

  const overdue = isCAPAOverdue(capa.status, capa.dueDate);

  let canEdit = true;
  try {
    await requirePermission(user.roleId, "CAPA", "Edit");
  } catch {
    canEdit = false;
  }

  // الانتقالات المسموحة بقت في جدول WorkflowDefinition (وحدة 9) بدل خريطة TS ثابتة — بتتقرا
  // هنا (Server Component) وتتبعت كـprop لـStatusTransitionButtons (client component).
  const allowedTransitions = canEdit
    ? await prisma.workflowDefinition.findMany({
        where: { orgId: user.orgId, entityType: "CAPA", fromStage: capa.status },
        select: { toStage: true },
      })
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/capa" className="text-sm text-muted-foreground hover:underline">
        → كل الإجراءات التصحيحية والوقائية
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{capa.rootCause ?? "إجراء تصحيحي/وقائي"}</h1>
        <Badge className={capaStatusStyle[capa.status]}>{capaStatusLabel[capa.status]}</Badge>
        {overdue && <Badge className={capaStatusStyle.Overdue}>متأخر</Badge>}
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">طريقة تحليل السبب</dt>
          <dd className="text-foreground">{capa.rootCauseMethod ? capaRootCauseMethodLabel[capa.rootCauseMethod] : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المسؤول</dt>
          <dd className="text-foreground">{capa.ownerUser.fullName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">الإجراء التصحيحي</dt>
          <dd className="text-foreground">{capa.correctiveAction ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">الإجراء الوقائي</dt>
          <dd className="text-foreground">{capa.preventiveAction ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">تاريخ الاستحقاق</dt>
          <dd className="text-foreground">{formatDate(capa.dueDate) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">تحقق منه</dt>
          <dd className="text-foreground">{capa.verifiedByUser?.fullName ?? "—"}</dd>
        </div>
      </dl>

      {canEdit && (
        <div className="mt-5">
          <StatusTransitionButtons capaId={capa.id} allowedStatuses={allowedTransitions.map((t) => t.toStage)} />
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        «متأخر» محسوب من تاريخ الاستحقاق وقت العرض — مش حالة مخزَّنة. تأكيد «فعّال»/«غير فعّال» بيسجّل مين تحقق منه تلقائيًا (مفروض على مستوى القاعدة).
      </p>
    </main>
  );
}
