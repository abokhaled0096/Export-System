"use client";

import { useActionState } from "react";
import { createMasterDataChangeRequest, type ChangeRequestFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { entityTypeLabel } from "@/lib/changeRequestLabels";

const initialState: ChangeRequestFormState = {};
const entityTypes = Object.keys(entityTypeLabel);

export default function ChangeRequestForm() {
  const [state, formAction, pending] = useActionState(createMasterDataChangeRequest, initialState);

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-type" className="text-xs">
          نوع الكيان *
        </Label>
        <Select name="entityType" defaultValue={entityTypes[0]}>
          <SelectTrigger id="cr-type">
            <SelectValue>{(value: string) => entityTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {entityTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.entityType && <span className="text-xs text-destructive">{state.errors.entityType[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cr-id" className="text-xs">
          معرّف الكيان *
        </Label>
        <Input id="cr-id" name="entityId" placeholder="UUID الصف المطلوب تعديله" />
        {state.errors?.entityId && <span className="text-xs text-destructive">{state.errors.entityId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="cr-changes" className="text-xs">
          التغييرات المقترحة (JSON) *
        </Label>
        <Input id="cr-changes" name="proposedChanges" placeholder='{"creditLimit": 50000}' className="font-mono" />
        <p className="text-[11px] text-muted-foreground">
          اكتب اسم الحقل وقيمته الجديدة بصيغة JSON — مثال: <code className="font-mono">{'{"creditLimit": 50000}'}</code> يعني
          &ldquo;غيّر حد الائتمان لـ 50000&rdquo;. لو محتاج تغيير أكتر من حقل، افصلهم بفاصلة، زي: <code className="font-mono">{'{"creditLimit": 50000, "city": "القاهرة"}'}</code>.
        </p>
        {state.errors?.proposedChanges && <span className="text-xs text-destructive">{state.errors.proposedChanges[0]}</span>}
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الإرسال..." : "+ طلب تعديل"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        ⚠️ الفورم ده لطلب تعديل كيان موجود بالفعل (معرّفه حقيقي) — الاعتماد هنا لسه تسجيل بس،
        مش بيطبّق التغييرات على الصف تلقائيًا (لسه محتاج قرار نطاق). طلبات إنشاء كيان جديد
        (Company/Supplier/BankAccount من غير صلاحية الإنشاء المباشر) بقت بوابة فعلية حقيقية —
        الاعتماد بيولّد الصف فعليًا.
      </p>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {state.formError}
        </p>
      )}
    </form>
  );
}
