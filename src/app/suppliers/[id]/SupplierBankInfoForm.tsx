"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateSupplierBankInfoAction, type SupplierBankInfoFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form } from "@/components/ui/form";

const initialState: SupplierBankInfoFormState = {};

/** بلا عرض القيمة الفعلية أبدًا — بادج "مسجّل" بس (نفس فلسفة "ممنوع تصدير/عرض بيانات بنكية
 * كاملة بضغطة واحدة"، CLAUDE.md). الفورم بيفضل مطوي لحد ما يُضغط "تعديل"، وإدخال حقل واحد
 * فاضي مايمسحش المسجّل بالفعل — راجع تعليق updateSupplierBankInfoAction. */
export default function SupplierBankInfoForm({
  supplierId,
  hasBankAccountName,
  hasBankIBAN,
}: {
  supplierId: string;
  hasBankAccountName: boolean;
  hasBankIBAN: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateSupplierBankInfoAction.bind(null, supplierId), initialState);

  // بعد حفظ ناجح، اتفوي الفورم ورجّع الوضع المطوي (البادجات المحدَّثة + رسالة النجاح) —
  // بلا كده state.success مايتعرضش أبدًا لأنه بس في فرع !editing. تعديل الحالة أثناء الـrender
  // (نمط React الموصى بيه) بدل useEffect — نفس الأسلوب المتّبع في BankTransactionForm.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <span className="text-foreground/80">اسم صاحب الحساب: {hasBankAccountName ? "🔒 مسجّل" : "— غير مسجّل"}</span>
        <span className="text-foreground/80">IBAN: {hasBankIBAN ? "🔒 مسجّل" : "— غير مسجّل"}</span>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          تعديل
        </Button>
        {state.success && <span className="text-xs text-emerald-700">اتحفظ بنجاح ✓</span>}
      </div>
    );
  }

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sup-bank-name" className="text-xs">
          اسم صاحب الحساب
        </Label>
        <Input id="sup-bank-name" name="bankAccountName" placeholder={hasBankAccountName ? "🔒 مسجّل — سيب فاضي عشان تسيبه زي ما هو" : ""} className="w-56" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sup-bank-iban" className="text-xs">
          IBAN
        </Label>
        <Input id="sup-bank-iban" name="bankIBAN" placeholder={hasBankIBAN ? "🔒 مسجّل — سيب فاضي عشان تسيبه زي ما هو" : ""} className="w-64 font-mono" dir="ltr" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
        إلغاء
      </Button>
      {state.errors?.bankAccountName && <span className="w-full text-xs text-destructive">{state.errors.bankAccountName[0]}</span>}
      {state.errors?.bankIBAN && <span className="w-full text-xs text-destructive">{state.errors.bankIBAN[0]}</span>}
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
          {state.mfaRequired && (
            <>
              {" "}
              <Link href={`/mfa/challenge?next=/suppliers/${supplierId}`} className="underline">
                تحقق دلوقتي
              </Link>
            </>
          )}
        </p>
      )}
    </Form>
  );
}
