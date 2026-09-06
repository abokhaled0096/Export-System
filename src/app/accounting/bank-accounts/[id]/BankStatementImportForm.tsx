"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  previewBankStatementImportAction,
  confirmBankStatementImportAction,
  type StatementImportPreviewState,
  type StatementImportConfirmState,
} from "../../treasury-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const initialPreviewState: StatementImportPreviewState = {};
const initialConfirmState: StatementImportConfirmState = {};

const STATUS_STYLE: Record<string, string> = {
  "سيتم استيراده": "bg-sky-100 text-sky-700 hover:bg-sky-100",
  "مضاهى تلقائيًا بدفعة": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "مكرر — متسجّل قبل كده": "bg-secondary text-secondary-foreground hover:bg-secondary",
};

/** استيراد كشف حساب بنكي — خطوتين إلزاميتين (معاينة بلا كتابة، ثم تأكيد صريح) لأنه معاملات
 * مالية بالجملة. `stage` بيتحدّد من تغيّر نتيجة كل Action (مقارنة مرجع أثناء الـrender، نفس
 * نمط بقية فورمات المطابقة/التعديل في المشروع) بدل useEffect. */
export default function BankStatementImportForm({ bankAccountId }: { bankAccountId: string }) {
  const previewAction = previewBankStatementImportAction.bind(null, bankAccountId);
  const confirmAction = confirmBankStatementImportAction.bind(null, bankAccountId);
  const [previewState, previewFormAction, previewPending] = useActionState(previewAction, initialPreviewState);
  const [confirmState, confirmFormAction, confirmPending] = useActionState(confirmAction, initialConfirmState);

  const [stage, setStage] = useState<"closed" | "upload" | "preview" | "done">("closed");

  const [prevPreviewState, setPrevPreviewState] = useState(previewState);
  if (previewState !== prevPreviewState) {
    setPrevPreviewState(previewState);
    if (previewState.preview) setStage("preview");
  }

  const [prevConfirmState, setPrevConfirmState] = useState(confirmState);
  if (confirmState !== prevConfirmState) {
    setPrevConfirmState(confirmState);
    if (confirmState.summary) setStage("done");
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">استيراد كشف حساب (CSV)</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            محتاج تحقق بخطوتين (MFA) — بيانات مالية بالجملة. معاينة الأثر قبل أي التزام فعلي.
          </p>
        </div>
        {stage === "closed" && (
          <div className="flex items-center gap-2">
            <Button nativeButton={false} variant="outline" size="sm" render={<a href="/accounting/bank-statement-template">تحميل قالب فارغ</a>} />
            <Button size="sm" onClick={() => setStage("upload")}>
              استيراد ملف
            </Button>
          </div>
        )}
        {stage === "done" && (
          <Button size="sm" variant="outline" onClick={() => setStage("upload")}>
            استيراد ملف تاني
          </Button>
        )}
      </div>

      {stage === "upload" && (
        <form action={previewFormAction} className="mt-4 flex flex-wrap items-end gap-3">
          <Input type="file" name="file" accept=".csv,text/csv" required className="w-64" />
          <Button type="submit" disabled={previewPending}>
            {previewPending ? "جاري الفحص..." : "معاينة"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStage("closed")}>
            إلغاء
          </Button>
          {previewState.formError && (
            <p role="alert" className="w-full text-sm text-destructive">
              {previewState.formError}
              {previewState.mfaRequired && (
                <>
                  {" "}
                  <Link href={`/mfa/challenge?next=/accounting/bank-accounts/${bankAccountId}`} className="underline">
                    تحقق دلوقتي
                  </Link>
                </>
              )}
            </p>
          )}
        </form>
      )}

      {stage === "preview" && previewState.preview && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">هيتسجّل</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{previewState.preview.toCreateCount}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">مضاهى تلقائيًا</p>
              <p className="mt-1 font-mono text-lg font-semibold text-emerald-700">{previewState.preview.autoMatchedCount}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">مكرر (متسجّل قبل كده)</p>
              <p className="mt-1 font-mono text-lg font-semibold text-muted-foreground">{previewState.preview.duplicateCount}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">أخطاء صفوف</p>
              <p
                className={`mt-1 font-mono text-lg font-semibold ${previewState.preview.rowErrors.length > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {previewState.preview.rowErrors.length}
              </p>
            </div>
          </div>

          <div className="flex gap-6 rounded-lg border border-border p-3 text-sm">
            <p>
              إجمالي وارد: <span className="font-mono text-emerald-700">{previewState.preview.inflowTotal}</span> {previewState.preview.currency}
            </p>
            <p>
              إجمالي صادر: <span className="font-mono text-rose-700">{previewState.preview.outflowTotal}</span> {previewState.preview.currency}
            </p>
          </div>

          {previewState.preview.rowErrors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {previewState.preview.rowErrors.slice(0, 20).map((e, i) => (
                <p key={i}>
                  سطر {e.row}: {e.message}
                </p>
              ))}
            </div>
          )}

          <div className="max-h-96 overflow-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>البيان/المرجع</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewState.preview.rows.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell className="text-foreground/80">{r.transactionDate}</TableCell>
                    <TableCell className="text-foreground/80">{r.transactionType}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{r.amount}</TableCell>
                    <TableCell className="text-foreground/80">{r.description ?? r.reference ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[r.status]}>{r.status}</Badge>
                      {r.matchedPaymentNumber && <span className="ms-1 font-mono text-xs text-muted-foreground">{r.matchedPaymentNumber}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <form action={confirmFormAction} className="flex items-center gap-3">
            <input type="hidden" name="payload" value={previewState.preview.payload} />
            <Button type="submit" disabled={confirmPending || previewState.preview.toCreateCount === 0}>
              {confirmPending ? "جاري الاستيراد..." : `تأكيد استيراد ${previewState.preview.toCreateCount} حركة`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStage("closed")}>
              إلغاء
            </Button>
          </form>

          {confirmState.formError && (
            <p role="alert" className="text-sm text-destructive">
              {confirmState.formError}
              {confirmState.mfaRequired && (
                <>
                  {" "}
                  <Link href={`/mfa/challenge?next=/accounting/bank-accounts/${bankAccountId}`} className="underline">
                    تحقق دلوقتي
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {stage === "done" && confirmState.summary && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          ✓ اتسجّل {confirmState.summary.created} حركة ({confirmState.summary.autoMatched} اتضاهى تلقائيًا)
          {confirmState.summary.skippedAsDuplicate > 0 && ` — ${confirmState.summary.skippedAsDuplicate} اتجاهل لأنه متسجّل قبل كده`}.
        </div>
      )}
    </div>
  );
}
