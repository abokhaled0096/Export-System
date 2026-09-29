"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * زرار بيفتح فورم في نافذة، بدل ما الفورم يبقى مفروش فوق القايمة.
 *
 * **المشكلة**: كل صفحة قايمة كانت بتبدأ بفورم إدخال ضخم والبيانات مدفونة تحته. تفتح
 * «الفواتير» تلاقي فورم، وتنزل تدوّر على الفاتورة. القايمة هي الأصل — الإضافة عملية
 * بتحصل من وقت للتاني.
 *
 * **إغلاق النافذة بعد النجاح**: الفورم هو اللي يعرف إنه نجح (مش النافذة)، فبنمرّرله
 * `close()` عبر Context. الفورمات عندها أصلًا `useEffect` بيتنفّذ عند النجاح (بيعمل
 * `router.push` أو بيفضّي الحقول) — بننده `close()` من هناك. لو الفورم مانداهاش، النافذة
 * بتفضل مفتوحة والمستخدم بيقفلها بنفسه، وده سلوك مقبول مش كسر.
 */

const FormDialogContext = createContext<(() => void) | null>(null);

/** بيرجّع دالة إغلاق النافذة، أو `null` لو الفورم مش جوه نافذة (مستخدم في صفحة عادية). */
export function useFormDialogClose(): (() => void) | null {
  return useContext(FormDialogContext);
}

export default function FormDialog({
  triggerLabel,
  title,
  description,
  children,
  className,
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className={className}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogBody>
            <FormDialogContext.Provider value={() => setOpen(false)}>{children}</FormDialogContext.Provider>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
