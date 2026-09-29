"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ImportState = {
  formError?: string;
  summary?: { created: number; failed: number; errors: { row: number; message: string }[] };
};

export default function ImportCsvForm({
  action,
  templateColumns,
}: {
  action: (prevState: ImportState, formData: FormData) => Promise<ImportState>;
  templateColumns: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
        الأعمدة المتوقّعة في سطر العناوين (بنفس الترتيب والتسمية دي، زي ملف «تصدير CSV» بالظبط):
        <br />
        {templateColumns.join("، ")}
      </div>

      <Input type="file" name="file" accept=".csv,text/csv" required />

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الاستيراد..." : "استيراد"}
      </Button>

      {state.formError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      {state.summary && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-emerald-700">✓ اتضاف {state.summary.created} صف بنجاح</p>
          {state.summary.failed > 0 && (
            <>
              <p className="mt-1 text-destructive">✗ فشل {state.summary.failed} صف</p>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                {state.summary.errors.map((e, i) => (
                  <li key={i}>
                    سطر {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}
