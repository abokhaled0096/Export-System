"use client";

import { useActionState } from "react";
import { createBooking, type BookingFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: BookingFormState = {};

export default function BookingForm({
  shipmentId,
  providers,
  freightQuotes,
}: {
  shipmentId: string;
  providers: { id: string; name: string }[];
  freightQuotes: { id: string; label: string }[];
}) {
  const action = createBooking.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bookingNumber" className="text-xs">
          رقم الحجز
        </Label>
        <Input id="bookingNumber" name="bookingNumber" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vessel" className="text-xs">
          السفينة
        </Label>
        <Input id="vessel" name="vessel" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="voyage" className="text-xs">
          رقم الرحلة
        </Label>
        <Input id="voyage" name="voyage" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-etd" className="text-xs">
          ETD
        </Label>
        <Input id="booking-etd" name="etd" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-eta" className="text-xs">
          ETA
        </Label>
        <Input id="booking-eta" name="eta" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="documentationCutoff" className="text-xs">
          إقفال المستندات
        </Label>
        <Input id="documentationCutoff" name="documentationCutoff" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vgmDeadline" className="text-xs">
          مهلة VGM
        </Label>
        <Input id="vgmDeadline" name="vgmDeadline" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="portClosingDate" className="text-xs">
          إقفال الميناء
        </Label>
        <Input id="portClosingDate" name="portClosingDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="freeTimeDays" className="text-xs">
          أيام السماح
        </Label>
        <Input id="freeTimeDays" name="freeTimeDays" type="number" min="0" className="w-20" />
      </div>
      {providers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-providerId" className="text-xs">
            مزوّد الخدمة
          </Label>
          <Select name="providerId">
            <SelectTrigger id="booking-providerId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => providers.find((p) => p.id === value)?.name ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {freightQuotes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-freightQuoteId" className="text-xs">
            عرض سعر الشحن
          </Label>
          <Select name="freightQuoteId">
            <SelectTrigger id="booking-freightQuoteId" className="w-40">
              <SelectValue placeholder="—">{(value: string) => freightQuotes.find((q) => q.id === value)?.label ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {freightQuotes.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ حجز"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
