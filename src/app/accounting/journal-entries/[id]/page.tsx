import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import PostEntryButton from "./PostEntryButton";
import ReverseEntryButton from "./ReverseEntryButton";
import DeleteDraftButton from "./DeleteDraftButton";
import { journalEntrySourceTypeLabel, journalEntryStatusLabel, journalEntryStatusStyle } from "@/lib/accountingLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const entry = await prisma.journalEntry.findFirst({
    where: { id, orgId },
    include: {
      period: true,
      preparedByUser: { select: { fullName: true } },
      reversalOf: { select: { id: true, entryNumber: true } },
      reversals: { select: { id: true, entryNumber: true } },
      lines: { include: { account: true, costCenter: true, profitCenter: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!entry) notFound();

  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/accounting/journal-entries">← رجوع للقيود</Link>} />
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{entry.entryNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entry.entryDate.toLocaleDateString("ar-EG")} · الفترة {entry.period.periodName} · {journalEntrySourceTypeLabel[entry.sourceType]}
          </p>
          {entry.description && <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Badge className={journalEntryStatusStyle[entry.status]}>{journalEntryStatusLabel[entry.status]}</Badge>
          {entry.status === "Draft" && (
            <>
              <PostEntryButton journalEntryId={entry.id} />
              <DeleteDraftButton journalEntryId={entry.id} />
            </>
          )}
          {entry.status === "Posted" && <ReverseEntryButton journalEntryId={entry.id} />}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">أُعدّ بمعرفة: {entry.preparedByUser.fullName}</p>

      {entry.status === "Posted" && (
        <p className="mt-2 text-xs text-muted-foreground">
          القيد مرحّل — لا يُعدَّل ولا يُحذف. التصحيح بقيد عكسي بس (زرار &quot;عكس القيد&quot;).
        </p>
      )}

      {entry.reversalOf && (
        <p className="mt-2 text-sm text-foreground/80">
          ده قيد عكسي للقيد{" "}
          <Link href={`/accounting/journal-entries/${entry.reversalOf.id}`} className="underline">
            {entry.reversalOf.entryNumber}
          </Link>
        </p>
      )}

      {entry.reversals.length > 0 && (
        <p className="mt-2 text-sm text-foreground/80">
          اتعكس بالقيد{" "}
          {entry.reversals.map((r) => (
            <Link key={r.id} href={`/accounting/journal-entries/${r.id}`} className="underline">
              {r.entryNumber}
            </Link>
          ))}
        </p>
      )}

      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحساب</TableHead>
                <TableHead>مدين</TableHead>
                <TableHead>دائن</TableHead>
                <TableHead>مركز التكلفة</TableHead>
                <TableHead>مركز الربحية</TableHead>
                <TableHead>وصف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-foreground">
                    {l.account.accountCode} — {l.account.nameAr}
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{Number(l.debit) > 0 ? l.debit.toString() : "—"}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{Number(l.credit) > 0 ? l.credit.toString() : "—"}</TableCell>
                  <TableCell className="text-foreground/80">{l.costCenter?.name ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{l.profitCenter?.name ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{l.description ?? "—"}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium text-foreground">الإجمالي</TableCell>
                <TableCell className="font-mono font-medium text-foreground">{totalDebit.toFixed(2)}</TableCell>
                <TableCell className="font-mono font-medium text-foreground">{totalCredit.toFixed(2)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
