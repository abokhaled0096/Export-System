import Link from "next/link";
import { Button } from "@/components/ui/button";
import ImportCsvForm from "@/components/ImportCsvForm";
import { importProductsCsv } from "../actions";

export default function ImportProductsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/products">← رجوع لقائمة المنتجات</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">استيراد منتجات من CSV</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        كل منتج بيتضاف بحالة «مسودة» — نفس أي منتج بيتضاف يدويًا، محتاج مراجعة بعد الاستيراد.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ده Route Handler بيرجّع
          ملف CSV (Content-Disposition: attachment) مش صفحة. <Link> بيعمل تنقّل client-side
          وبيكسر التنزيل. */}
      <Button nativeButton={false} variant="outline" className="mt-4" render={<a href="/products/import/template">تحميل قالب فارغ (CSV)</a>} />
      <div className="mt-4">
        <ImportCsvForm
          action={importProductsCsv}
          templateColumns={[
            "الاسم بالعربية",
            "Name (English)",
            "HS Code",
            "الفئة",
            "بلد المنشأ",
            "موسم الحصاد",
            "مدة الصلاحية (يوم)",
            "يحتاج تبريد",
          ]}
        />
      </div>
    </main>
  );
}
