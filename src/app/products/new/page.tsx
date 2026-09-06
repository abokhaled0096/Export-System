import Link from "next/link";
import { Button } from "@/components/ui/button";
import ProductForm from "./ProductForm";

export default function NewProductPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/products">← رجوع لقائمة المنتجات</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">منتج جديد</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        بيانات أساسية فقط (نطاق P1) — الحقول الموسّعة (الشهادات، الصور، المصادر) في Phase 2.
      </p>
      <div className="mt-8">
        <ProductForm />
      </div>
    </main>
  );
}
