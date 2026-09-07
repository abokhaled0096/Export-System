import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import WorkflowDefinitionForm from "./WorkflowDefinitionForm";
import DeleteWorkflowDefinitionButton from "./DeleteWorkflowDefinitionButton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function WorkflowDefinitionsPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "WorkflowDefinition", "View");
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
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028: كل استعلام من getScopedPrisma() بيفتح
  // transaction لوحده، والتنفيذ بالتوازي بيتزاحم على اتصال الـpool).
  const definitions = await prisma.workflowDefinition.findMany({
    where: { orgId: user.orgId },
    include: { requiredApprovalPolicy: { select: { subjectType: true } } },
    orderBy: [{ entityType: "asc" }, { fromStage: "asc" }],
  });
  const approvalPolicies = await prisma.approvalPolicy.findMany({
    where: { orgId: user.orgId },
    orderBy: { subjectType: "asc" },
    select: { id: true, subjectType: true },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">انتقالات المراحل المسموحة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{definitions.length} انتقال مسموح</p>
      </div>

      <div className="mt-6">
        <WorkflowDefinitionForm approvalPolicies={approvalPolicies} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكيان</TableHead>
              <TableHead>من مرحلة</TableHead>
              <TableHead>لـمرحلة</TableHead>
              <TableHead>سياسة موافقة مطلوبة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {definitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش انتقالات مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              definitions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-foreground/80">{d.entityType}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{d.fromStage}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{d.toStage}</TableCell>
                  <TableCell>
                    {d.requiredApprovalPolicy ? (
                      <Badge variant="secondary">{d.requiredApprovalPolicy.subjectType}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DeleteWorkflowDefinitionButton workflowDefinitionId={d.id} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        الكيانات المربوطة فعليًا بالمحرك دلوقتي: Opportunity، CAPA، Product، Requirement، Gate، وOriginProof (راجع updateOpportunityStageAction/updateCAPAStatusAction/updateProduct/updateRequirementStatus/decideGate/updateOriginProofAction). القيود الحرجة الحقيقية (RFQAnalysis قبل QuoteSent، verifiedBy قبل إقفال CAPA، متطلبات حاجبة/PEM/مهلة ACI قبل عبور بوابة) لسه مفروضة على مستوى القاعدة (Trigger) بغض النظر عن الجدول ده.
      </p>
    </main>
  );
}
