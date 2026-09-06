import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** فورم بحث GET بسيط بلا JavaScript — بيحافظ على أي فلاتر تانية (حالة/مرحلة) عبر حقول hidden. */
export default function ListSearch({
  basePath,
  q,
  hiddenParams,
  placeholder = "بحث...",
}: {
  basePath: string;
  q?: string;
  hiddenParams?: Record<string, string | undefined>;
  placeholder?: string;
}) {
  return (
    <form action={basePath} className="flex gap-2">
      {Object.entries(hiddenParams ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null
      )}
      <Input type="search" name="q" defaultValue={q} placeholder={placeholder} className="w-56" />
      <Button type="submit" variant="outline">
        بحث
      </Button>
    </form>
  );
}
