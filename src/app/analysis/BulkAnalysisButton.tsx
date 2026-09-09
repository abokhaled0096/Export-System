"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StartBatchFormState } from "./batchActions";

const initialState: StartBatchFormState = {};

/** زرار تشغيل دفعة "حلّل/ابحث على كل التركيبات" — مشترك بين /analysis و/competitors بتصميم واحد،
 * بس كل صفحة بتمرّرله الـServer Action المناسبة (startMarketAnalysisBatchAction/
 * startCompetitorsBatchAction) عشان يفضلوا منفصلين تمامًا زي ما اتفقنا. */
export default function BulkAnalysisButton({
  action,
  label,
  description,
  colorClass,
}: {
  action: (prevState: StartBatchFormState, formData: FormData) => Promise<StartBatchFormState>;
  label: string;
  description: string;
  colorClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (!open) {
    return (
      <Button type="button" className={colorClass} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-foreground/80">{description}</p>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulk-year" className="text-xs">
            السنة
          </Label>
          <Input id="bulk-year" name="year" type="number" defaultValue={new Date().getFullYear()} className="w-28" />
        </div>
        <Button type="submit" className={colorClass} disabled={pending}>
          {pending ? "جاري البدء..." : "ابدأ"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          إلغاء
        </Button>
      </div>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
