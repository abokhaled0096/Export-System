"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  closeReconciliationAction,
  toggleTransactionInReconciliationAction,
  matchTransactionToPaymentAction,
} from "../../treasury-actions";
import { bankTransactionTypeLabel, isInflow } from "@/lib/treasuryLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type WorkspaceTransaction = {
  id: string;
  date: string;
  type: string;
  amount: string;
  description: string;
  included: boolean;
  paymentId: string | null;
  paymentNumber: string | null;
};

export type WorkspacePayment = { id: string; label: string; amount: string };

export default function ReconciliationWorkspace({
  reconciliationId,
  transactions,
  openPayments,
  difference,
  isClosed,
  currency,
}: {
  reconciliationId: string;
  transactions: WorkspaceTransaction[];
  openPayments: WorkspacePayment[];
  difference: string;
  isClosed: boolean;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [matchTarget, setMatchTarget] = useState<Record<string, string>>({});

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  const balanced = difference === "0.00" || difference === "-0.00";

  return (
    <div className="mt-6">
      {!isClosed && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Button
            disabled={pending || !balanced}
            onClick={() => run(() => closeReconciliationAction(reconciliationId))}
          >
            {pending ? "..." : "إقفال المطابقة"}
          </Button>
          {!balanced && (
            <span className="text-sm text-amber-700">
              الفرق لسه {difference} {currency} — الإقفال مقفول لحد ما يوصل صفر (مفروض على مستوى القاعدة كمان).
            </span>
          )}
          {balanced && <span className="text-sm text-emerald-700">الفرق صفر — جاهزة للإقفال.</span>}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold text-foreground">حركات الحساب</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        ضُم الحركات اللي في الكشف للمطابقة، وضاهي كل حركة بالدفعة المسجَّلة المقابلة ليها.
      </p>

      <div className="mt-3 space-y-2">
        {transactions.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-muted-foreground">
            مفيش حركات على الحساب ده لحد تاريخ الكشف.
          </p>
        ) : (
          transactions.map((t) => (
            <div
              key={t.id}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                t.included ? "border-primary/40 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <span className="w-24 font-mono text-xs text-foreground/70">{t.date}</span>
              <span className="w-24 text-sm text-foreground/80">{bankTransactionTypeLabel[t.type]}</span>
              <span className={`w-28 font-mono text-sm ${isInflow(t.type) ? "text-emerald-700" : "text-rose-700"}`}>
                {isInflow(t.type) ? "+" : "−"}
                {t.amount}
              </span>
              <span className="flex-1 truncate text-sm text-muted-foreground">{t.description}</span>

              {t.paymentNumber ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">مضاهاة {t.paymentNumber}</Badge>
              ) : isClosed ? (
                <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">غير مضاهاة</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    value={matchTarget[t.id] ?? ""}
                    onValueChange={(v) => setMatchTarget((prev) => ({ ...prev, [t.id]: String(v) }))}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue>
                        {(value: string) => openPayments.find((p) => p.id === value)?.label ?? "— ضاهي بدفعة —"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {openPayments.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || !matchTarget[t.id]}
                    onClick={() => run(() => matchTransactionToPaymentAction(t.id, matchTarget[t.id]))}
                  >
                    مضاهاة
                  </Button>
                </div>
              )}

              {!isClosed && (
                <Button
                  variant={t.included ? "secondary" : "outline"}
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => toggleTransactionInReconciliationAction(reconciliationId, t.id, !t.included))}
                >
                  {t.included ? "استبعاد" : "ضم للمطابقة"}
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {openPayments.length > 0 && !isClosed && (
        <p className="mt-4 text-xs text-muted-foreground">
          {openPayments.length} دفعة محصّلة لسه من غير حركة بنكية مقابلة — دي غالبًا سبب الفرق.{" "}
          <Link href="/accounting/payments" className="text-primary hover:underline">
            راجع الدفعات
          </Link>
        </p>
      )}
    </div>
  );
}
