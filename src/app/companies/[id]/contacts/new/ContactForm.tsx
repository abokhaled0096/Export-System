"use client";

import { useActionState } from "react";
import { createContact, type ContactFormState } from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const initialState: ContactFormState = {};

const roles = [
  "DecisionMaker",
  "EconomicBuyer",
  "TechnicalEvaluator",
  "User",
  "Procurement",
  "Finance",
  "Quality",
  "Logistics",
  "Gatekeeper",
  "Influencer",
  "Champion",
  "Opponent",
  "Unknown",
];

export default function ContactForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState(createContact, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">الاسم *</Label>
          <Input id="name" name="name" />
          {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">المسمى الوظيفي</Label>
          <Input id="title" name="title" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">الإيميل</Label>
          <Input id="email" name="email" type="email" />
          {state.errors?.email && <span className="text-xs text-destructive">{state.errors.email[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="decisionRole">دور القرار</Label>
          <Select name="decisionRole">
            <SelectTrigger id="decisionRole" className="w-full">
              <SelectValue placeholder="— غير محدد —" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground/70">
        رقم الهاتف مؤجَّل — الحقل 🔒 مشفّر عموديًا وآلية التشفير لسه محتاجة قرار قبل ما نفتح إدخاله.
      </p>

      <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <Checkbox name="consentGiven" className="mt-0.5" />
        <span className="text-xs text-muted-foreground">
          الشخص ده وافق على إن بياناته تتحفظ وتتستخدم للتواصل التجاري (PDPL) — الموافقة اتاخدت
          فعليًا (إيميل/مكالمة/توقيع)، مش مجرد افتراض.
        </span>
      </label>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ جهة الاتصال"}
      </Button>
    </form>
  );
}
