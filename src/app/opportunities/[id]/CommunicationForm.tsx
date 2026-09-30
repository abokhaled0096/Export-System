"use client";

import { useActionState } from "react";
import { createCommunication, type CommunicationFormState } from "./actions";
import { communicationChannelLabel, communicationDirectionLabel } from "@/lib/communicationLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: CommunicationFormState = {};
const channels = Object.keys(communicationChannelLabel);
const directions = Object.keys(communicationDirectionLabel);

export default function CommunicationForm({
  opportunityId,
  companyId,
  contacts,
}: {
  opportunityId: string;
  companyId: string;
  contacts: { id: string; name: string }[];
}) {
  const action = createCommunication.bind(null, opportunityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="companyId" value={companyId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="channel" className="text-xs">
          القناة
        </Label>
        <Select name="channel" defaultValue={channels[0]}>
          <SelectTrigger id="channel" className="w-36">
            <SelectValue>{(value: string) => communicationChannelLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c} value={c}>
                {communicationChannelLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="direction" className="text-xs">
          الاتجاه
        </Label>
        <Select name="direction" defaultValue={directions[0]}>
          <SelectTrigger id="direction" className="w-28">
            <SelectValue>{(value: string) => communicationDirectionLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {directions.map((d) => (
              <SelectItem key={d} value={d}>
                {communicationDirectionLabel[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {contacts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="comm-contactId" className="text-xs">
            جهة الاتصال
          </Label>
          <Select name="contactId">
            <SelectTrigger id="comm-contactId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => contacts.find((c) => c.id === value)?.name ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject" className="text-xs">
          الموضوع
        </Label>
        <Input id="subject" name="subject" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="summary" className="text-xs">
          الملخص
        </Label>
        <Input id="summary" name="summary" className="w-56" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="occurredAt" className="text-xs">
          تاريخ التواصل *
        </Label>
        <Input id="occurredAt" name="occurredAt" type="datetime-local" className="w-48" />
        {state.errors?.occurredAt && <span className="text-xs text-destructive">{state.errors.occurredAt[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="respondedAt" className="text-xs">
          تاريخ الرد
        </Label>
        <Input id="respondedAt" name="respondedAt" type="datetime-local" className="w-48" />
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="requiresReply" name="requiresReply" />
        <Label htmlFor="requiresReply" className="text-xs font-normal">
          يحتاج رد
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ تواصل"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
