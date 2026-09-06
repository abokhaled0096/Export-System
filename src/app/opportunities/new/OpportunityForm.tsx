"use client";

import { useActionState } from "react";
import { createOpportunity, type OpportunityFormState } from "../actions";
import { useFormDraft } from "@/lib/useFormDraft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: OpportunityFormState = {};

type Option = { id: string; label: string };

export default function OpportunityForm({
  companies,
  contacts,
  products,
  markets,
  defaultCompanyId,
}: {
  companies: Option[];
  contacts: (Option & { companyId: string })[];
  products: Option[];
  markets: Option[];
  defaultCompanyId?: string;
}) {
  const [state, formAction, pending] = useActionState(createOpportunity, initialState);

  // حفظ تلقائي محلي في المتصفح — راجع src/lib/useFormDraft.ts وBACKLOG.md § فقدان بيانات صامت.
  const draft = useFormDraft("opportunity-new");
  const val = (name: string) => draft.values[name] ?? "";
  const companyId = val("companyId") || defaultCompanyId || "";

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {draft.hasRestoredDraft && (
        <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <span>استرجعنا مسودة كنت بتكتبها قبل كده.</span>
          <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={draft.clearDraft}>
            امسح المسودة وابدأ من جديد
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyId">الشركة *</Label>
          <Select name="companyId" value={companyId} onValueChange={(v) => draft.setField("companyId", v ?? "")}>
            <SelectTrigger id="companyId" className="w-full">
              <SelectValue placeholder="اختر شركة">
                {(value: string | null) =>
                  value ? (companies.find((c) => c.id === value)?.label ?? value) : "اختر شركة"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.companyId && (
            <span className="text-xs text-destructive">{state.errors.companyId[0]}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactId">جهة الاتصال</Label>
          <Select name="contactId" value={val("contactId")} onValueChange={(v) => draft.setField("contactId", v ?? "")}>
            <SelectTrigger id="contactId" className="w-full">
              <SelectValue placeholder="— بدون —">
                {(value: string | null) =>
                  value ? (contacts.find((c) => c.id === value)?.label ?? value) : "— بدون —"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productId">المنتج *</Label>
          <Select name="productId" value={val("productId")} onValueChange={(v) => draft.setField("productId", v ?? "")}>
            <SelectTrigger id="productId" className="w-full">
              <SelectValue placeholder="اختر منتج">
                {(value: string | null) =>
                  value ? (products.find((p) => p.id === value)?.label ?? value) : "اختر منتج"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.productId && (
            <span className="text-xs text-destructive">{state.errors.productId[0]}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marketId">السوق *</Label>
          <Select name="marketId" value={val("marketId")} onValueChange={(v) => draft.setField("marketId", v ?? "")}>
            <SelectTrigger id="marketId" className="w-full">
              <SelectValue placeholder="اختر سوق">
                {(value: string | null) =>
                  value ? (markets.find((m) => m.id === value)?.label ?? value) : "اختر سوق"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.marketId && (
            <span className="text-xs text-destructive">{state.errors.marketId[0]}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expectedValue">القيمة المتوقعة</Label>
          <Input
            id="expectedValue"
            name="expectedValue"
            type="number"
            value={val("expectedValue")}
            onChange={(e) => draft.setField("expectedValue", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">العملة</Label>
          <Input
            id="currency"
            name="currency"
            placeholder="EUR"
            value={val("currency")}
            onChange={(e) => draft.setField("currency", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="indicativeIncoterm">Incoterm مبدئي</Label>
          <Input
            id="indicativeIncoterm"
            name="indicativeIncoterm"
            placeholder="FOB"
            value={val("indicativeIncoterm")}
            onChange={(e) => draft.setField("indicativeIncoterm", e.target.value)}
          />
        </div>
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ الفرصة"}
      </Button>
    </form>
  );
}
