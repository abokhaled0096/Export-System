"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StartBatchFormState } from "./batchActions";
import { Form } from "@/components/ui/form";

const initialState: StartBatchFormState = {};

type Option = { id: string; label: string };

/** زرار تشغيل دفعة "حلّل/ابحث على كل التركيبات" — مشترك بين /analysis و/competitors بتصميم واحد،
 * بس كل صفحة بتمرّرله الـServer Action المناسبة (startMarketAnalysisBatchAction/
 * startCompetitorsBatchAction) عشان يفضلوا منفصلين تمامًا زي ما اتفقنا.
 *
 * اختيار جزئي (Checkboxes) بدل "كله أو لا شيء" — كله متعلَّم افتراضيًا (نفس السلوك القديم لو
 * سيبته زي ما هو). forceRefresh (MarketAnalysis بس) بيتخطّى فلترة "تحليل حديث لسه صالح" اللي
 * startBatch بيعملها تلقائيًا. */
export default function BulkAnalysisButton({
  action,
  label,
  description,
  colorClass,
  products,
  markets,
  showForceRefresh = false,
}: {
  action: (prevState: StartBatchFormState, formData: FormData) => Promise<StartBatchFormState>;
  label: string;
  description: string;
  colorClass: string;
  products: Option[];
  markets: Option[];
  showForceRefresh?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(() => new Set(products.map((p) => p.id)));
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(() => new Set(markets.map((m) => m.id)));

  if (!open) {
    return (
      <Button type="button" className={colorClass} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <Form action={formAction} state={state} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-foreground/80">{description}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">المنتجات ({selectedProducts.size} من {products.length})</Label>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setSelectedProducts(selectedProducts.size === products.length ? new Set() : new Set(products.map((p) => p.id)))}>
              {selectedProducts.size === products.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
            </button>
          </div>
          <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-border p-2">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" name="productIds" value={p.id} checked={selectedProducts.has(p.id)} onChange={() => toggle(selectedProducts, setSelectedProducts, p.id)} />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">الأسواق ({selectedMarkets.size} من {markets.length})</Label>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setSelectedMarkets(selectedMarkets.size === markets.length ? new Set() : new Set(markets.map((m) => m.id)))}>
              {selectedMarkets.size === markets.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
            </button>
          </div>
          <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-border p-2">
            {markets.map((m) => (
              <label key={m.id} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" name="marketIds" value={m.id} checked={selectedMarkets.has(m.id)} onChange={() => toggle(selectedMarkets, setSelectedMarkets, m.id)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {showForceRefresh && (
        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input type="checkbox" name="forceRefresh" />
          أعد تحليل حتى التركيبات اللي عندها تحليل حديث لسه صالح (افتراضيًا بتتستبعد توفيرًا لاستدعاءات الذكاء الاصطناعي)
        </label>
      )}

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulk-year" className="text-xs">
            السنة
          </Label>
          <Input id="bulk-year" name="year" type="number" defaultValue={new Date().getFullYear()} className="w-28" />
        </div>
        <Button type="submit" className={colorClass} disabled={pending || selectedProducts.size === 0 || selectedMarkets.size === 0}>
          {pending ? "جاري البدء..." : `ابدأ (${selectedProducts.size * selectedMarkets.size} تركيبة)`}
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
    </Form>
  );
}
