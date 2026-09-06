import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { restoreMarket } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ArchivedMarketsPage() {
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const markets = await prisma.market.findMany({
    where: { orgId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الأسواق المؤرشفة</h1>
          <p className="mt-1 text-sm text-muted-foreground">{markets.length} سوق مؤرشف</p>
        </div>
        <Button nativeButton={false} variant="outline" render={<Link href="/markets">← رجوع للأسواق</Link>} />
      </div>

      {markets.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>مفيش أسواق مؤرشفة دلوقتي.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الدولة</TableHead>
                <TableHead>القارة</TableHead>
                <TableHead>تاريخ الأرشفة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{m.countryNameAr}</div>
                    <div className="text-xs text-muted-foreground">{m.countryNameEn}</div>
                  </TableCell>
                  <TableCell className="text-foreground/80">{m.continent}</TableCell>
                  <TableCell className="text-foreground/80">
                    {m.deletedAt?.toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell className="text-end">
                    <form action={restoreMarket.bind(null, m.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        استعادة
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
