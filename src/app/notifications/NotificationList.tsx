"use client";

import { useOptimistic, useState, useTransition } from "react";
import { markNotificationReadAction } from "../governance/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notificationTypeLabel } from "@/lib/notification";

export type NotificationData = {
  id: string;
  notificationType: string;
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
};

/** Optimistic UI (BACKLOG.md § P3) — تعليم "مقروء" بيحدّث الشكل (البادج، لون الخلفية، عدّاد
 * غير المقروء فوق) فورًا وقت الضغط، مش بعد ما السيرفر يرد. لو السيرفر رفض (نادر — العملية دي
 * مفيهاش قيد عمل حقيقي يترفض)، useOptimistic بيرجّع الحالة لأصلها تلقائيًا لما الـtransition
 * تخلص، والخطأ بيظهر تحت الإشعار المتأثر. */
export default function NotificationList({
  notifications: initial,
  total,
  unreadTotal,
}: {
  notifications: NotificationData[];
  /** إجمالي الإشعارات عبر كل الصفحات (بعد إضافة الـpagination) — لو مش متبعت بيرجع لطول الصفحة الحالية. */
  total?: number;
  /** إجمالي غير المقروء عبر كل الصفحات — لو مش متبعت بيرجع لعدّ الصفحة الحالية بس. */
  unreadTotal?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [optimisticNotifications, markRead] = useOptimistic(initial, (state, id: string) =>
    state.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
  );
  // baseline بيفضل صحيح عبر الصفحات بعد إضافة الـpagination؛ الخصم بيحصل أول بأول محليًا فور
  // الضغط (useOptimistic) بدل ما ننتظر رد السيرفر — نفس سلوك markRead فوق.
  const [optimisticUnreadTotal, decrementUnreadTotal] = useOptimistic(
    unreadTotal ?? initial.filter((n) => !n.readAt).length,
    (state: number, _id: string) => Math.max(0, state - 1)
  );

  function handleMarkRead(id: string) {
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)));
    startTransition(async () => {
      markRead(id);
      decrementUnreadTotal(id);
      try {
        await markNotificationReadAction(id);
      } catch (e) {
        setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "حصل خطأ." }));
      }
    });
  }

  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">
        {total ?? optimisticNotifications.length} إشعار — {optimisticUnreadTotal} غير مقروء
      </p>

      <div className="mt-6 space-y-2">
        {optimisticNotifications.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-muted-foreground">مفيش إشعارات لسه.</p>
        ) : (
          optimisticNotifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 rounded-xl border p-4 transition-colors ${n.readAt ? "border-border bg-card" : "border-primary/40 bg-primary/5"}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {!n.readAt && <Badge className="bg-primary text-primary-foreground hover:bg-primary">جديد</Badge>}
                  <span className="text-xs text-muted-foreground">{notificationTypeLabel[n.notificationType] ?? n.notificationType}</span>
                </div>
                <p className="mt-1 font-medium text-foreground">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{n.createdAt.slice(0, 16).replace("T", " ")}</p>
                {errors[n.id] && <p className="mt-1 text-xs text-destructive">{errors[n.id]}</p>}
              </div>
              {!n.readAt && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => handleMarkRead(n.id)}>
                  تعليم كمقروء
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
