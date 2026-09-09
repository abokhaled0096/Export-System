"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { processNextBatchItem, type BatchView } from "@/app/analysis/batchActions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const itemStatusLabel: Record<string, string> = {
  Pending: "⏳ في الانتظار",
  Running: "🔄 جاري التحليل...",
  Succeeded: "✅ خلص",
  Failed: "❌ فشل",
};

/** بيعالج الدفعة عن طريق نداء processNextBatchItem بـpolling كل 2 ثانية — تركيبة واحدة لكل نداء
 * (مفيش queue حقيقي في المشروع). بيوقف نفسه لما status="Completed". لو المستخدم قفل الصفحة، الدفعة
 * بتقف مؤقتًا — لو رجع لنفس الرابط، الـpolling بيكمل من أول Pending item باقي. */
export default function BatchProgress({
  batchId,
  initialView,
  productLabels,
  marketLabels,
  resultBaseHref,
}: {
  batchId: string;
  initialView: BatchView;
  productLabels: Record<string, string>;
  marketLabels: Record<string, string>;
  resultBaseHref: string;
}) {
  const [view, setView] = useState(initialView);
  const processingRef = useRef(false);

  useEffect(() => {
    if (view.status === "Completed" || view.status === "Cancelled") return;

    const interval = setInterval(async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        const next = await processNextBatchItem(batchId);
        setView(next);
      } finally {
        processingRef.current = false;
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [batchId, view.status]);

  const done = view.succeededCount + view.failedCount;
  const percent = view.totalPairs > 0 ? Math.round((done / view.totalPairs) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/80">
            {done} من {view.totalPairs} ({view.succeededCount} نجح، {view.failedCount} فشل)
          </span>
          <Badge
            className={
              view.status === "Completed"
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-sky-100 text-sky-700 hover:bg-sky-100"
            }
          >
            {view.status === "Completed" ? "✅ خلصت" : "🔄 شغّالة..."}
          </Badge>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead>السوق</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>التفاصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-foreground/80">{productLabels[item.productId] ?? "—"}</TableCell>
                <TableCell className="text-foreground/80">{marketLabels[item.marketId] ?? "—"}</TableCell>
                <TableCell className="text-sm">{itemStatusLabel[item.status] ?? item.status}</TableCell>
                <TableCell className="text-xs">
                  {item.status === "Succeeded" && item.resultId && view.kind === "MarketAnalysis" ? (
                    <Link href={`${resultBaseHref}/${item.resultId}`} className="text-primary hover:underline">
                      عرض التحليل
                    </Link>
                  ) : item.status === "Succeeded" && view.kind === "Competitors" ? (
                    <span className="text-emerald-700">اتسجّل في قائمة المنافسين</span>
                  ) : item.status === "Failed" && item.errorMessage ? (
                    <span className="text-destructive">{item.errorMessage}</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
