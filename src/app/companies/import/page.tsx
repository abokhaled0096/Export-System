import Link from "next/link";
import { Button } from "@/components/ui/button";
import ImportCsvForm from "@/components/ImportCsvForm";
import { importCompaniesCsv } from "../actions";

export default function ImportCompaniesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/companies">← رجوع لقائمة الشركات</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">استيراد شركات من CSV</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        كل شركة بيتضاف بحالة «عميل محتمل» وملكيتها ليك. عمود «التصنيف» ممكن ياخد أكتر من قيمة مفصولة بـ«؛».
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ده Route Handler بيرجّع
          ملف CSV (Content-Disposition: attachment) مش صفحة. <Link> بيعمل تنقّل client-side
          وبيكسر التنزيل. */}
      <Button nativeButton={false} variant="outline" className="mt-4" render={<a href="/companies/import/template">تحميل قالب فارغ (CSV)</a>} />
      <div className="mt-4">
        <ImportCsvForm
          action={importCompaniesCsv}
          templateColumns={["الاسم القانوني", "الاسم التجاري", "الدولة", "المدينة", "التصنيف"]}
        />
      </div>
    </main>
  );
}
