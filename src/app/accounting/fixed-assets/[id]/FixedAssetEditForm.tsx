"use client";

import { useActionState, useState } from "react";
import { updateFixedAssetAction, type FixedAssetEditFormState } from "../../finance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: FixedAssetEditFormState = {};

export default function FixedAssetEditForm({
  assetId,
  nameAr,
  nameEn,
  costCenterId,
  costCenters,
}: {
  assetId: string;
  nameAr: string;
  nameEn: string;
  costCenterId: string | null;
  costCenters: Array<{ id: string; code: string; name: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateFixedAssetAction.bind(null, assetId), initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          تعديل
        </Button>
        {state.success && <span className="text-xs text-emerald-700">اتحفظ بنجاح ✓</span>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-edit-ar" className="text-xs">
          الاسم بالعربي *
        </Label>
        <Input id="fa-edit-ar" name="nameAr" defaultValue={nameAr} className="w-44" />
        {state.errors?.nameAr && <span className="text-xs text-destructive">{state.errors.nameAr[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-edit-en" className="text-xs">
          الاسم بالإنجليزي *
        </Label>
        <Input id="fa-edit-en" name="nameEn" defaultValue={nameEn} className="w-44" />
        {state.errors?.nameEn && <span className="text-xs text-destructive">{state.errors.nameEn[0]}</span>}
      </div>
      {costCenters.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fa-edit-cc" className="text-xs">
            مركز التكلفة
          </Label>
          <Select name="costCenterId" defaultValue={costCenterId ?? undefined}>
            <SelectTrigger id="fa-edit-cc">
              <SelectValue>{(value: string) => costCenters.find((c) => c.id === value)?.name ?? "— بدون —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
        إلغاء
      </Button>
      {state.formError && <p className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
