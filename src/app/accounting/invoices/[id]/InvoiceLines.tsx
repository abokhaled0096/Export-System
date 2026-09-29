"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInvoiceLine, deleteInvoiceLine, type InvoiceLineFormState } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type InvoiceLineRow = {
  id: string;
  lineNumber: number;
  description: string;
  hsCode: string | null;
  countryOfOrigin: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRatePct: string;
  lineTotal: string;
  lineTax: string;
};

export type ProductOption = { id: string; label: string; hsCode: string | null; originCountry: string | null };

type Props = {
  invoiceId: string;
  currency: string;
  editable: boolean;
  lines: InvoiceLineRow[];
  products: ProductOption[];
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
};

const initialState: InvoiceLineFormState = {};

export default function InvoiceLines({ invoiceId, currency, editable, lines, products, subtotal, taxAmount, totalAmount }: Props) {
  const [state, formAction, pending] = useActionState(addInvoiceLine, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // بعد نجاح الإضافة: نفضّي الفورم عشان البند اللي بعده، والصفحة بتتحدّث من السيرفر
  // (الإجماليات بتتحسب هناك بالـTrigger — مفيش نسخة محلية منها تتزامن غلط).
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  /**
   * اختيار منتج بيملّي الوصف وكود HS وبلد المنشأ — أقل إدخال يدوي = أقل خطأ في مستند جمركي.
   * الملء بيتم مباشرة على الحقول (uncontrolled) مش بـuseState: كده `form.reset()` فوق بيفضّي
   * كل حاجة بما فيها الاختيار ده، من غير setState جوه effect (react-hooks/set-state-in-effect).
   */
  function fillFromProduct(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const form = formRef.current;
    if (!form) return;
    const set = (name: string, value: string) => {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = value;
    };
    set("description", product.label);
    set("hsCode", product.hsCode ?? "");
    set("countryOfOrigin", product.originCountry ?? "Egypt");
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">بنود الفاتورة</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        إجمالي الفاتورة بيتحسب من البنود دي على مستوى قاعدة البيانات — مش بيتكتب بالإيد. الفاتورة مش هتتصدر بلا بند واحد على
        الأقل، وبعد الإصدار البنود بتتقفل والتعديل بيبقى بإشعار خصم أو إضافة.
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>الصنف</TableHead>
              <TableHead>كود HS</TableHead>
              <TableHead>المنشأ</TableHead>
              <TableHead className="text-start">الكمية</TableHead>
              <TableHead>الوحدة</TableHead>
              <TableHead className="text-start">سعر الوحدة</TableHead>
              <TableHead className="text-start">ض.ق.م %</TableHead>
              <TableHead className="text-start">إجمالي البند</TableHead>
              {editable && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={editable ? 10 : 9} className="py-6 text-center text-muted-foreground">
                  مفيش بنود لسه — ضيف أول صنف من الفورم تحت.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground">{l.lineNumber}</TableCell>
                  <TableCell className="text-foreground">{l.description}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{l.hsCode ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{l.countryOfOrigin ?? "—"}</TableCell>
                  <TableCell className="font-mono text-foreground">{l.quantity}</TableCell>
                  <TableCell className="text-foreground/80">{l.unit}</TableCell>
                  <TableCell className="font-mono text-foreground">{l.unitPrice}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{l.taxRatePct}</TableCell>
                  <TableCell className="font-mono font-medium text-foreground">{l.lineTotal}</TableCell>
                  {editable && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deleting}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          startDelete(async () => {
                            setDeleteError(null);
                            const res = await deleteInvoiceLine(l.id);
                            if (!res.ok) setDeleteError(res.error);
                            else router.refresh();
                          })
                        }
                      >
                        حذف
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
          {lines.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={editable ? 8 : 7} className="text-start text-muted-foreground">
                  الصافي
                </TableCell>
                <TableCell className="font-mono text-foreground" colSpan={2}>
                  {subtotal}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={editable ? 8 : 7} className="text-start text-muted-foreground">
                  الضريبة
                </TableCell>
                <TableCell className="font-mono text-foreground" colSpan={2}>
                  {taxAmount}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={editable ? 8 : 7} className="text-start font-semibold text-foreground">
                  الإجمالي
                </TableCell>
                <TableCell className="font-mono text-base font-semibold text-foreground" colSpan={2}>
                  {totalAmount} {currency}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {deleteError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {deleteError}
        </p>
      )}

      {editable && (
        <form ref={formRef} action={formAction} className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />

          {products.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-product" className="text-xs">
                المنتج
              </Label>
              <Select name="productId" onValueChange={(v) => fillFromProduct(String(v))}>
                <SelectTrigger id="line-product">
                  <SelectValue>{(value: string) => products.find((p) => p.id === value)?.label ?? "— بند حر —"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground">سيبه فاضي لبند زي النولون أو التأمين.</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-desc" className="text-xs">
              وصف الصنف *
            </Label>
            <Input id="line-desc" name="description" />
            {state.errors?.description && <span className="text-xs text-destructive">{state.errors.description[0]}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-hs" className="text-xs">
              كود HS
            </Label>
            <Input id="line-hs" name="hsCode" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-origin" className="text-xs">
              بلد المنشأ
            </Label>
            <Input id="line-origin" name="countryOfOrigin" defaultValue="Egypt" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-qty" className="text-xs">
              الكمية *
            </Label>
            <Input id="line-qty" name="quantity" type="number" step="0.001" />
            {state.errors?.quantity && <span className="text-xs text-destructive">{state.errors.quantity[0]}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-unit" className="text-xs">
              الوحدة *
            </Label>
            <Input id="line-unit" name="unit" defaultValue="kg" />
            {state.errors?.unit && <span className="text-xs text-destructive">{state.errors.unit[0]}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-price" className="text-xs">
              سعر الوحدة ({currency}) *
            </Label>
            <Input id="line-price" name="unitPrice" type="number" step="0.0001" />
            {state.errors?.unitPrice && <span className="text-xs text-destructive">{state.errors.unitPrice[0]}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-tax" className="text-xs">
              ض.ق.م %
            </Label>
            <Input id="line-tax" name="taxRatePct" type="number" step="0.01" defaultValue="0" />
            {state.errors?.taxRatePct && <span className="text-xs text-destructive">{state.errors.taxRatePct[0]}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-weight" className="text-xs">
              الوزن الصافي (كجم)
            </Label>
            <Input id="line-weight" name="netWeightKg" type="number" step="0.001" />
          </div>

          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? "جاري الإضافة..." : "+ بند"}
            </Button>
          </div>

          {state.formError && (
            <p role="alert" className="text-sm text-destructive sm:col-span-3 lg:col-span-4">
              {state.formError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
