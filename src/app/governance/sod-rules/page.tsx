import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import SoDRuleForm from "./SoDRuleForm";
import ToggleRuleButton from "./ToggleRuleButton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SoDRulesPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "SegregationOfDutyRule", "View");
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
  const rules = await prisma.segregationOfDutyRule.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">قواعد فصل المهام</h1>
        <p className="mt-1 text-sm text-muted-foreground">{rules.length} قاعدة</p>
      </div>

      <div className="mt-6">
        <SoDRuleForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفعل الأول</TableHead>
              <TableHead>الفعل الثاني</TableHead>
              <TableHead>أشخاص مختلفين؟</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش قواعد فصل مهام مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-foreground/80">{r.action1}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{r.action2}</TableCell>
                  <TableCell className="text-foreground/80">{r.mustBeDifferentUser ? "نعم" : "لا"}</TableCell>
                  <TableCell>
                    <Badge className={r.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-secondary text-secondary-foreground hover:bg-secondary"}>
                      {r.isActive ? "مفعّلة" : "موقوفة"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ToggleRuleButton ruleId={r.id} isActive={r.isActive} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        القاعدة اللي بتربط Payment.Create وPayment.Approve هي الوحيدة المفروضة فعليًا على مستوى القاعدة دلوقتي (Trigger) — تفعيلها بيمنع منشئ الدفعة من اعتمادها بنفسه فورًا.
      </p>
    </main>
  );
}
