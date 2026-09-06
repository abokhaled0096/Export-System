"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: string; label: string };

export default function ProductMarketFilterForm({
  products,
  markets,
  selectedProductId,
  selectedMarketId,
}: {
  products: Option[];
  markets: Option[];
  selectedProductId?: string;
  selectedMarketId?: string;
}) {
  const router = useRouter();

  const navigate = (productId?: string, marketId?: string) => {
    const params = new URLSearchParams();
    if (productId) params.set("productId", productId);
    if (marketId) params.set("marketId", marketId);
    router.push(`/compliance/requirements?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-productId" className="text-xs">
          المنتج
        </Label>
        {/* value={... ?? null} عمدًا مش undefined — لو الأول undefined وبعدين بقى قيمة حقيقية بعد
            الـnavigate، Base UI بيحذّر "Select changing from uncontrolled to controlled". null من
            الأول بيخلّي الـSelect متحكَّم فيه من البداية (نفس نمط SelectValue's render-prop). */}
        <Select
          value={selectedProductId ?? null}
          onValueChange={(v) => navigate(v ?? undefined, selectedMarketId)}
        >
          <SelectTrigger id="filter-productId" className="w-48">
            <SelectValue placeholder="اختر منتج">
              {(value: string | null) => (value ? products.find((p) => p.id === value)?.label ?? value : "اختر منتج")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-marketId" className="text-xs">
          السوق
        </Label>
        <Select
          value={selectedMarketId ?? null}
          onValueChange={(v) => navigate(selectedProductId, v ?? undefined)}
        >
          <SelectTrigger id="filter-marketId" className="w-48">
            <SelectValue placeholder="اختر سوق">
              {(value: string | null) => (value ? markets.find((m) => m.id === value)?.label ?? value : "اختر سوق")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {markets.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
