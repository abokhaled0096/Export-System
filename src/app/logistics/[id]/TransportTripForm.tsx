"use client";

import { useActionState } from "react";
import { createTransportTrip, type TransportTripFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencySelect from "@/components/CurrencySelect";
import { Form } from "@/components/ui/form";

const initialState: TransportTripFormState = {};

export default function TransportTripForm({ shipmentId }: { shipmentId: string }) {
  const action = createTransportTrip.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="carrier" className="text-xs">
          الناقل
        </Label>
        <Input id="carrier" name="carrier" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vehicleNumber" className="text-xs">
          رقم المركبة
        </Label>
        <Input id="vehicleNumber" name="vehicleNumber" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="driverName" className="text-xs">
          اسم السائق
        </Label>
        <Input id="driverName" name="driverName" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickupLocation" className="text-xs">
          موقع الاستلام
        </Label>
        <Input id="pickupLocation" name="pickupLocation" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="appointmentAt" className="text-xs">
          موعد الحجز
        </Label>
        <Input id="appointmentAt" name="appointmentAt" type="datetime-local" className="w-52" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loadingStart" className="text-xs">
          بداية التحميل
        </Label>
        <Input id="loadingStart" name="loadingStart" type="datetime-local" className="w-52" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loadingFinish" className="text-xs">
          نهاية التحميل
        </Label>
        <Input id="loadingFinish" name="loadingFinish" type="datetime-local" className="w-52" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gateInAt" className="text-xs">
          دخول الميناء
        </Label>
        <Input id="gateInAt" name="gateInAt" type="datetime-local" className="w-52" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="emptyReturnAt" className="text-xs">
          إرجاع الحاوية الفارغة
        </Label>
        <Input id="emptyReturnAt" name="emptyReturnAt" type="datetime-local" className="w-52" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tt-cost" className="text-xs">
          التكلفة
        </Label>
        <Input id="tt-cost" name="cost" type="number" min="0" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tt-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="tt-currency" name="currency" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ رحلة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
