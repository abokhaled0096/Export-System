import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Pagination({
  currentPage,
  totalPages,
  basePath,
  extraParams,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  /** أي فلاتر تانية (بحث/حالة) لازم تفضل موجودة لما تتنقل بين الصفحات — راجع BACKLOG.md. */
  extraParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      <Button
        nativeButton={false}
        variant="outline"
        size="sm"
        disabled={prevDisabled}
        render={<Link href={hrefFor(Math.max(1, currentPage - 1))} />}
      >
        السابق
      </Button>
      <span className="text-muted-foreground">
        صفحة {currentPage} من {totalPages}
      </span>
      <Button
        nativeButton={false}
        variant="outline"
        size="sm"
        disabled={nextDisabled}
        render={<Link href={hrefFor(Math.min(totalPages, currentPage + 1))} />}
      >
        التالي
      </Button>
    </div>
  );
}
