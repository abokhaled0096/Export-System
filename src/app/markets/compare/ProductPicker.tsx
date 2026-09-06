import { Button } from "@/components/ui/button";

export default function ProductPicker({
  products,
  selectedProductId,
}: {
  products: { id: string; label: string }[];
  selectedProductId?: string;
}) {
  return (
    <form action="/markets/compare" method="get" className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="productId" className="text-xs text-muted-foreground">
          المنتج
        </label>
        <select
          id="productId"
          name="productId"
          defaultValue={selectedProductId ?? ""}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>
            اختر منتج
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm">
        قارن
      </Button>
    </form>
  );
}
