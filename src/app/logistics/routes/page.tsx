import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import RouteForm from "./RouteForm";
import { routeClassificationLabel, routeClassificationStyle, transportModeLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Route", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـLogisticsOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();
  const routes = await prisma.route.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/logistics">← رجوع للوجستيات</Link>} />

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">خطوط الشحن</h1>
        <p className="mt-1 text-sm text-muted-foreground">{routes.length} خط مسجّل</p>
      </div>

      <div className="mt-6">
        <RouteForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الميناءين</TableHead>
              <TableHead>وسائل النقل</TableHead>
              <TableHead>مدة الشحن المعتادة</TableHead>
              <TableHead>التصنيف</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  لسه مفيش خطوط مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/logistics/routes/${r.id}`}>{r.originPort} ← {r.destinationPort}</Link>} />
                  </TableCell>
                  <TableCell className="text-foreground/80">
                    {r.transportModes.map((m) => transportModeLabel[m] ?? m).join("، ") || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{r.typicalTransitDays ? `${r.typicalTransitDays} يوم` : "—"}</TableCell>
                  <TableCell>
                    <Badge className={routeClassificationStyle[r.classification]}>{routeClassificationLabel[r.classification]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
