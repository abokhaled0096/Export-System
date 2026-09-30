"use client";

import { useActionState } from "react";
import { createRoute, type RouteFormState } from "./actions";
import { routeClassificationLabel, transportModeLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: RouteFormState = {};
const classifications = Object.keys(routeClassificationLabel);
const modes = Object.keys(transportModeLabel);

export default function RouteForm() {
  const [state, formAction, pending] = useActionState(createRoute, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="originPort" className="text-xs">
            ميناء المنشأ *
          </Label>
          <Input id="originPort" name="originPort" className="w-32" />
          {state.errors?.originPort && <span className="text-xs text-destructive">{state.errors.originPort[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="destinationPort" className="text-xs">
            ميناء الوصول *
          </Label>
          <Input id="destinationPort" name="destinationPort" className="w-32" />
          {state.errors?.destinationPort && <span className="text-xs text-destructive">{state.errors.destinationPort[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transitPorts" className="text-xs">
            موانئ عبور (مفصولة بفاصلة)
          </Label>
          <Input id="transitPorts" name="transitPorts" className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transshipmentCount" className="text-xs">
            عدد مرات النقل العابر
          </Label>
          <Input id="transshipmentCount" name="transshipmentCount" type="number" min="0" className="w-20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="typicalTransitDays" className="text-xs">
            مدة الشحن المعتادة (أيام)
          </Label>
          <Input id="typicalTransitDays" name="typicalTransitDays" type="number" min="0" className="w-24" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="worstTransitDays" className="text-xs">
            أسوأ مدة (أيام)
          </Label>
          <Input id="worstTransitDays" name="worstTransitDays" type="number" min="0" className="w-24" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weeklySailings" className="text-xs">
            رحلات أسبوعية
          </Label>
          <Input id="weeklySailings" name="weeklySailings" type="number" min="0" className="w-20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="classification" className="text-xs">
            التصنيف
          </Label>
          <Select name="classification" defaultValue={classifications[5]}>
            <SelectTrigger id="classification" className="w-36">
              <SelectValue>{(value: string) => routeClassificationLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {classifications.map((c) => (
                <SelectItem key={c} value={c}>
                  {routeClassificationLabel[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الإضافة..." : "+ خط ملاحي"}
        </Button>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">وسائل النقل</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {modes.map((m) => (
            <div key={m} className="flex items-center gap-1.5">
              <Checkbox id={`mode-${m}`} name="transportModes" value={m} />
              <Label htmlFor={`mode-${m}`} className="text-xs font-normal">
                {transportModeLabel[m]}
              </Label>
            </div>
          ))}
        </div>
      </div>
      {state.formError && <p role="alert" className="text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
