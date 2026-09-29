"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createInvoice, type InvoiceFormState } from "../arap-actions";
import { invoiceTypeLabel } from "@/lib/arapLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: InvoiceFormState = {};

export type InvoiceFormOption = {
  id: string;
  label: string;
  currency?: string;
  total?: string;
  companyId?: string | null;
  supplierId?: string | null;
};

type Props = {
  salesOrders: InvoiceFormOption[];
  purchaseOrders: InvoiceFormOption[];
  companies: InvoiceFormOption[];
  suppliers: InvoiceFormOption[];
  documents: InvoiceFormOption[];
};

const types = Object.keys(invoiceTypeLabel);

export default function InvoiceForm({ salesOrders, purchaseOrders, companies, suppliers, documents }: Props) {
  const [state, formAction, pending] = useActionState(createInvoice, initialState);
  const router = useRouter();
  const [invoiceType, setInvoiceType] = useState(types[0]);
  const [salesOrderId, setSalesOrderId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  // مفتاح واحد بيتولّد لحظة فتح الفورم — بيمنع فاتورة مكرّرة لو المستخدم دبّس "+ فاتورة" مرتين.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // اختيار أمر البيع بيملّي العميل/العملة/الصافي تلقائيًا — أقل إدخال يدوي = أقل خطأ.
  const selectedOrder = salesOrders.find((o) => o.id === salesOrderId);
  // نفس المبدأ لفاتورة المشتريات: اختيار أمر الشراء بيملّي المورّد/العملة/الصافي.
  const selectedPO = purchaseOrders.find((o) => o.id === purchaseOrderId);

  useEffect(() => {
    if (state.invoiceId) router.push(`/accounting/invoices/${state.invoiceId}`);
  }, [state.invoiceId, router]);

  const isSales = invoiceType === "SalesInvoice" || invoiceType === "CreditNote" || invoiceType === "ProformaInvoice";

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-type" className="text-xs">
          نوع الفاتورة *
        </Label>
        <Select name="invoiceType" value={invoiceType} onValueChange={(v) => setInvoiceType(String(v))}>
          <SelectTrigger id="inv-type">
            <SelectValue>{(value: string) => invoiceTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {invoiceTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isSales && salesOrders.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-so" className="text-xs">
            أمر البيع
          </Label>
          <Select name="salesOrderId" value={salesOrderId} onValueChange={(v) => setSalesOrderId(String(v))}>
            <SelectTrigger id="inv-so">
              <SelectValue>
                {(value: string) => salesOrders.find((o) => o.id === value)?.label ?? "— بدون —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {salesOrders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isSales && companies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-company" className="text-xs">
            العميل
          </Label>
          <Select name="companyId" defaultValue={selectedOrder?.companyId ?? ""} key={selectedOrder?.companyId ?? "none"}>
            <SelectTrigger id="inv-company">
              <SelectValue>
                {(value: string) => companies.find((c) => c.id === value)?.label ?? "— بدون —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isSales && purchaseOrders.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-po" className="text-xs">
            أمر الشراء
          </Label>
          <Select name="purchaseOrderId" value={purchaseOrderId} onValueChange={(v) => setPurchaseOrderId(String(v))}>
            <SelectTrigger id="inv-po">
              <SelectValue>
                {(value: string) => purchaseOrders.find((o) => o.id === value)?.label ?? "— بدون —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {purchaseOrders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isSales && suppliers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-supplier" className="text-xs">
            المورّد
          </Label>
          <Select name="supplierId" defaultValue={selectedPO?.supplierId ?? ""} key={selectedPO?.supplierId ?? "none"}>
            <SelectTrigger id="inv-supplier">
              <SelectValue>
                {(value: string) => suppliers.find((s) => s.id === value)?.label ?? "— بدون —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isSales && documents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-doc" className="text-xs">
            المستند الإلكتروني (ETA)
          </Label>
          <Select name="documentId">
            <SelectTrigger id="inv-doc">
              <SelectValue>
                {(value: string) => documents.find((d) => d.id === value)?.label ?? "— بدون —"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {documents.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">مطلوب ومعتمد من مصلحة الضرائب قبل الإصدار.</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-currency" className="text-xs">
          العملة *
        </Label>
        <Input
          id="inv-currency"
          name="currency"
          defaultValue={selectedOrder?.currency ?? selectedPO?.currency ?? "EGP"}
          key={selectedOrder?.currency ?? selectedPO?.currency ?? "cur"}
        />
        {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-issue" className="text-xs">
          تاريخ الإصدار *
        </Label>
        <Input id="inv-issue" name="issueDate" type="date" />
        {state.errors?.issueDate && <span className="text-xs text-destructive">{state.errors.issueDate[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inv-due" className="text-xs">
          تاريخ الاستحقاق *
        </Label>
        <Input id="inv-due" name="dueDate" type="date" />
        {state.errors?.dueDate && <span className="text-xs text-destructive">{state.errors.dueDate[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="inv-notes" className="text-xs">
          ملاحظات
        </Label>
        <Input id="inv-notes" name="notes" />
      </div>

      <div className="flex flex-col justify-end gap-1.5 sm:col-span-2 lg:col-span-3">
        <p className="text-[11px] text-muted-foreground">
          الفاتورة بتتعمل كمسودة، وبتضيف بنودها (صنف، كمية، سعر وحدة، كود HS) من صفحتها. الإجمالي بيتحسب من البنود — مفيش
          إدخال يدوي للمبالغ. لو اخترت أمر بيع، بنوده بتتنسخ تلقائيًا.
        </p>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "جاري الإنشاء..." : "+ فاتورة"}
          </Button>
        </div>
      </div>

      {state.formError && (
        <p role="alert" className="sm:col-span-2 lg:col-span-3 text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
