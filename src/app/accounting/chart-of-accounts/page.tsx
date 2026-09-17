import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import ChartOfAccountForm from "./ChartOfAccountForm";
import ChartOfAccountEditControl from "./ChartOfAccountEditControl";
import { accountTypeLabel, normalBalanceLabel } from "@/lib/accountingLabels";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type AccountNode = {
  id: string;
  accountCode: string;
  nameAr: string;
  nameEn: string;
  accountType: string;
  normalBalance: string;
  currency: string | null;
  parentAccountId: string | null;
  isActive: boolean;
};

function buildTree(accounts: AccountNode[], parentId: string | null): AccountNode[] {
  return accounts.filter((a) => a.parentAccountId === parentId).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

function AccountRow({ account, accounts, depth }: { account: AccountNode; accounts: AccountNode[]; depth: number }) {
  const children = buildTree(accounts, account.id);
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border py-2 text-sm" style={{ paddingInlineStart: `${depth * 1.25}rem` }}>
        <span className="font-mono text-foreground">{account.accountCode}</span>
        <span className="text-foreground">{account.nameAr}</span>
        <span className="text-xs text-muted-foreground">({account.nameEn})</span>
        <Badge variant="secondary">{accountTypeLabel[account.accountType]}</Badge>
        <span className="text-xs text-muted-foreground">{normalBalanceLabel[account.normalBalance]}</span>
        {account.currency && <span className="text-xs text-muted-foreground">{account.currency}</span>}
        <ChartOfAccountEditControl accountId={account.id} nameAr={account.nameAr} nameEn={account.nameEn} isActive={account.isActive} />
      </div>
      {children.map((c) => (
        <AccountRow key={c.id} account={c} accounts={accounts} depth={depth + 1} />
      ))}
    </>
  );
}

export default async function ChartOfAccountsPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "ChartOfAccount", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لدور Finance/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const accounts = await prisma.chartOfAccount.findMany({
    where: { orgId },
    select: { id: true, accountCode: true, nameAr: true, nameEn: true, accountType: true, normalBalance: true, currency: true, parentAccountId: true, isActive: true },
    orderBy: { accountCode: "asc" },
  });

  const roots = buildTree(accounts, null);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">شجرة الحسابات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{accounts.length} حساب مسجّل</p>
      </div>

      <div className="mt-6">
        <ChartOfAccountForm accounts={accounts} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        {roots.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">لسه مفيش حسابات مسجّلة.</p>
        ) : (
          roots.map((r) => <AccountRow key={r.id} account={r} accounts={accounts} depth={0} />)
        )}
      </div>
    </main>
  );
}
