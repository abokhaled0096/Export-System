"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 transition-opacity duration-150",
        "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // 90vh + overflow: الفورمات هنا طويلة، ومن غير السقف ده الدايلوج بيطلع برّه الشاشة
          // وأزرار الحفظ تبقى مش قابلة للوصول على اللابتوب.
          // ⚠️ التوسيط بـinset-0 + m-auto مش بـstart-1/2 + -translate-x-1/2: التاني بيحسب
          // الإزاحة في اتجاه واحد، فالنافذة كانت بتطلع برّه الشاشة في RTL (اتشاف فعليًا).
          // الطريقة دي بتشتغل صح في الاتجاهين من غير ما تعتمد على اتجاه الصفحة أصلًا.
          "fixed inset-0 z-50 m-auto flex h-fit max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col rounded-xl border border-border bg-card shadow-xl outline-none",
          "transition-all duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4", className)}
      {...props}
    >
      <div className="min-w-0">{children}</div>
      <DialogPrimitive.Close
        aria-label="إغلاق"
        className="shrink-0 rounded-lg p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <XIcon className="size-4" />
      </DialogPrimitive.Close>
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-base font-semibold text-foreground", className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description data-slot="dialog-description" className={cn("mt-0.5 text-xs text-muted-foreground", className)} {...props} />
  );
}

/** جسم الدايلوج — هو اللي بيتمرّر فيه السكرول، مش الـpopup كله، عشان الهيدر يفضل ثابت. */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-body" className={cn("min-h-0 flex-1 overflow-y-auto p-5", className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody };
