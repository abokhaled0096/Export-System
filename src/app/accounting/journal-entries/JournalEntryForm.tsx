"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createJournalEntry, type JournalEntryFormState } from "../actions";
import { journalEntrySourceTypeLabel } from "@/lib/accountingLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: JournalEntryFormState = {};
const sourceTypes = Object.keys(journalEntrySourceTypeLabel);

type Row = { key: number; debit: string; credit: string };

let rowKeySeq = 0;
function emptyRow(): Row {
  return { key: rowKeySeq++, debit: "", credit: "" };
}

export default function JournalEntryForm({
  periods,
  accounts,
  costCenters,
  profitCenters,
  defaultCurrency,
}: {
  periods: { id: string; periodName: string }[];
  accounts: { id: string; accountCode: string; nameAr: string }[];
  costCenters: { id: string; code: string; name: string }[];
  profitCenters: { id: string; code: string; name: string }[];
  defaultCurrency: string;
}) {
  const [state, formAction, pending] = useActionState(createJournalEntry, initialState);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const router = useRouter();

  useEffect(() => {
    if (state.entryId) router.push(`/accounting/journal-entries/${state.entryId}`);
  }, [state.entryId, router]);

  const totalDebit = rows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <Form action={formAction} state={state} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodId" className="text-xs">
            الفترة المحاسبية *
          </Label>
          <Select name="periodId">
            <SelectTrigger id="periodId" className="w-32">
              <SelectValue placeholder="اختر فترة">{(value: string) => periods.find((p) => p.id === value)?.periodName ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.periodName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entryDate" className="text-xs">
            تاريخ القيد *
          </Label>
          <Input id="entryDate" name="entryDate" type="date" className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sourceType" className="text-xs">
            المصدر
          </Label>
          <Select name="sourceType" defaultValue={sourceTypes[0]}>
            <SelectTrigger id="sourceType" className="w-32">
              <SelectValue>{(value: string) => journalEntrySourceTypeLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sourceTypes.map((s) => (
                <SelectItem key={s} value={s}>
                  {journalEntrySourceTypeLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="je-description" className="text-xs">
            الوصف
          </Label>
          <Input id="je-description" name="description" className="w-56" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">البنود</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
            + إضافة بند
          </Button>
        </div>

        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">الحساب</Label>
              <Select name="lineAccountId">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="اختر حساب">
                    {(value: string) => {
                      const acc = accounts.find((a) => a.id === value);
                      return acc ? `${acc.accountCode} — ${acc.nameAr}` : value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.accountCode} — {a.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">مدين</Label>
              <Input
                name="lineDebit"
                type="number"
                min="0"
                step="0.01"
                className="w-24"
                value={row.debit}
                onChange={(e) => updateRow(row.key, { debit: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">دائن</Label>
              <Input
                name="lineCredit"
                type="number"
                min="0"
                step="0.01"
                className="w-24"
                value={row.credit}
                onChange={(e) => updateRow(row.key, { credit: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">العملة</Label>
              <Input name="lineCurrency" defaultValue={defaultCurrency} className="w-16" />
            </div>
            {costCenters.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">مركز التكلفة</Label>
                <Select name="lineCostCenterId">
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="—">{(value: string) => costCenters.find((c) => c.id === value)?.name ?? value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {profitCenters.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">مركز الربحية</Label>
                <Select name="lineProfitCenterId">
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="—">{(value: string) => profitCenters.find((p) => p.id === value)?.name ?? value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {profitCenters.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">وصف البند</Label>
              <Input name="lineDescription" className="w-32" />
            </div>
            {rows.length > 2 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}>
                حذف
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className={`flex items-center gap-4 rounded-lg px-3 py-2 text-sm ${balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        <span>إجمالي المدين: {totalDebit.toFixed(2)}</span>
        <span>إجمالي الدائن: {totalCredit.toFixed(2)}</span>
        <span className="font-medium">{balanced ? "✓ القيد متوازن" : "⚠ القيد غير متوازن"}</span>
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ القيد (Draft)"}
      </Button>
      {state.formError && <p role="alert" className="text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
