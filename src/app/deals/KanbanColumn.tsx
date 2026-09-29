"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { loadMoreDealsAction, type DealCardData } from "./actions";
import { Button } from "@/components/ui/button";

export type { DealCardData };

/** عمود Kanban واحد بـpagination حقيقي مستقل — "تحميل المزيد" بيجيب صفحة إضافية من نفس العمود
 * بس (server action)، بدل ما كل الصفقات المفتوحة تتحمّل مرة واحدة بسقف إجمالي بيتقسّم بين
 * الأعمدة (راجع BACKLOG.md § P2/P3). */
export default function KanbanColumn({
  status,
  label,
  borderClass,
  totalCount,
  initialDeals,
  initialHasMore,
  q,
}: {
  status: "Draft" | "Pricing" | "Negotiation" | "Won" | "Lost";
  label: string;
  borderClass: string;
  totalCount: number;
  initialDeals: DealCardData[];
  initialHasMore: boolean;
  q?: string;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function loadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await loadMoreDealsAction(status, deals.length, q);
        setDeals((prev) => [...prev, ...result.deals]);
        setHasMore(result.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ أثناء تحميل المزيد.");
      }
    });
  }

  return (
    <div className={`rounded-xl border-t-4 bg-muted/40 p-3 ${borderClass}`}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground/80">{label}</h2>
        <span className="text-xs text-muted-foreground">{totalCount}</span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {deals.map((d) => (
          <Link
            key={d.id}
            href={`/deals/${d.id}`}
            className="block rounded-lg border border-border bg-card p-3 text-sm hover:border-primary/40 hover:shadow-sm"
          >
            <p className="font-medium text-foreground">{d.customerName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {d.productName} · {d.marketName}
            </p>
            {d.value && (
              <p className="mt-1 font-mono text-xs text-foreground/70">
                {d.value} {d.currency}
              </p>
            )}
          </Link>
        ))}
      </div>
      {hasMore && (
        <Button variant="outline" size="sm" className="mt-3 w-full" disabled={pending} onClick={loadMore}>
          {pending ? "..." : `تحميل المزيد (${totalCount - deals.length} متبقي)`}
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
