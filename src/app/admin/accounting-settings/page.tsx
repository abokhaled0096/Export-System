import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import AccountingSettingsForm from "./AccountingSettingsForm";

export const dynamic = "force-dynamic";

export default async function AccountingSettingsPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          معندكش صلاحية الوصول للصفحة دي — إعدادات المحاسبة متاحة لـAdmin/CompanyOwner بس.
        </div>
      </main>
    );
  }

  const scopedPrisma = await getScopedPrisma();
  const org = await scopedPrisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">إعدادات المحاسبة</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        العملة الوظيفية (Functional Currency) — العملة اللي تقارير المنظمة الماليّة بتتبنى عليها.
      </p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        فاضية (الوضع الافتراضي): محاسبة عملة واحدة كلاسيكية — كل قيد لازم يكون بعملة واحدة، بلا
        فروق عملة. لو حطّيتها: القيود بقى ممكن تحتوي بنود بعملات مختلفة (كل بند محتاج سعر صرف
        صريح وقت الإدخال)، وفرق العملة المحقَّق بيتحسب تلقائيًا وقت تخصيص كل دفعة على فاتورتها
        (`/accounting/invoices`/`payments`)، وفيه أداة إعادة تقييم دورية للفواتير المفتوحة
        (`/accounting/fx-revaluation`). ده قرار بيأثر على الترحيل المحاسبي كله — راجعه مع المحاسب
        قبل التفعيل.
      </p>

      <div className="mt-6">
        <AccountingSettingsForm currentFunctionalCurrency={org.functionalCurrency} />
      </div>
    </main>
  );
}
