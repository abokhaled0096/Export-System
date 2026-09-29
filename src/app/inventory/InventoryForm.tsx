"use client";

import { useActionState, useEffect } from "react";
import { createInventory, type InventoryFormState } from "./actions";
import { inventoryTypeLabel, inventoryStatusLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";
import { useFormDialogClose } from "@/components/FormDialog";

const initialState: InventoryFormState = {};
const inventoryTypes = Object.keys(inventoryTypeLabel);
const inventoryStatuses = Object.keys(inventoryStatusLabel);

export default function InventoryForm({
  products,
  batches,
  lots,
}: {
  products: { id: string; nameAr: string }[];
  batches: { id: string; batchCode: string }[];
  lots: { id: string; lotCode: string }[];
}) {
  const [state, formAction, pending] = useActionState(createInventory, initialState);
  // بترجّع null لو الفورم مش جوه نافذة — فالاستخدام في صفحة عادية بيفضل زي ما هو.
  const closeDialog = useFormDialogClose();

  // `state.ok` بيتضبط من الـaction عند النجاح بس — القايمة ورا النافذة بتكون اتحدّثت
  // بالفعل بـrevalidatePath، فالإغلاق هنا هو آخر خطوة.
  useEffect(() => {
    if (state.ok) closeDialog?.();
  }, [state.ok, closeDialog]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="productId" className="text-xs">
          المنتج *
        </Label>
        <Select name="productId">
          <SelectTrigger id="productId" className="w-36">
            <SelectValue placeholder="اختر منتج">{(value: string) => products.find((p) => p.id === value)?.nameAr ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nameAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.productId && <span className="text-xs text-destructive">{state.errors.productId[0]}</span>}
      </div>
      {batches.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="batchId" className="text-xs">
            الدفعة
          </Label>
          <Select name="batchId">
            <SelectTrigger id="batchId" className="w-32">
              <SelectValue placeholder="—">{(value: string) => batches.find((b) => b.id === value)?.batchCode ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.batchCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {lots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lotId" className="text-xs">
            الـLot
          </Label>
          <Select name="lotId">
            <SelectTrigger id="lotId" className="w-32">
              <SelectValue placeholder="—">{(value: string) => lots.find((l) => l.id === value)?.lotCode ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {lots.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.lotCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inventoryType" className="text-xs">
          النوع *
        </Label>
        <Select name="inventoryType" defaultValue={inventoryTypes[0]}>
          <SelectTrigger id="inventoryType" className="w-32">
            <SelectValue>{(value: string) => inventoryTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {inventoryTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {inventoryTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity" className="text-xs">
          الكمية *
        </Label>
        <Input id="quantity" name="quantity" type="number" min="0" step="0.001" className="w-24" />
        {state.errors?.quantity && <span className="text-xs text-destructive">{state.errors.quantity[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unit" className="text-xs">
          الوحدة
        </Label>
        <Input id="unit" name="unit" className="w-20" placeholder="kg" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location" className="text-xs">
          الموقع
        </Label>
        <Input id="location" name="location" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-status" className="text-xs">
          الحالة *
        </Label>
        <Select name="status" defaultValue={inventoryStatuses[0]}>
          <SelectTrigger id="inv-status" className="w-32">
            <SelectValue>{(value: string) => inventoryStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {inventoryStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {inventoryStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expiryDate" className="text-xs">
          تاريخ الصلاحية
        </Label>
        <Input id="expiryDate" name="expiryDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unitCost" className="text-xs">
          تكلفة الوحدة
        </Label>
        <Input id="unitCost" name="unitCost" type="number" min="0" step="0.0001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="inv-currency" name="currency" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ سجل مخزون"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
