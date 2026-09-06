"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { eraseContactData, type EraseContactState } from "../actions";
import { Button } from "@/components/ui/button";

const initialState: EraseContactState = {};

export default function ContactPdplActions({ companyId, contactId }: { companyId: string; contactId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(eraseContactData.bind(null, contactId), initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state, router]);

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      <div className="flex items-center gap-3 text-xs">
        <Button
          nativeButton={false}
          variant="link"
          className="h-auto p-0 text-xs"
          render={
            <a href={`/companies/${companyId}/contacts/${contactId}/export`} target="_blank" rel="noreferrer">
              تصدير بياناته (PDPL)
            </a>
          }
        />
        <form
          action={formAction}
          onSubmit={(e) => {
            if (!confirm("محو بيانات جهة الاتصال ده نهائي — هيتشال الاسم والإيميل والدور. متأكد؟")) {
              e.preventDefault();
            }
          }}
        >
          <Button type="submit" variant="link" className="h-auto p-0 text-xs text-destructive" disabled={pending}>
            {pending ? "جاري المحو..." : "محو بياناته (PDPL)"}
          </Button>
        </form>
      </div>
      {state.formError && <p role="alert" className="text-xs text-destructive">{state.formError}</p>}
    </div>
  );
}
