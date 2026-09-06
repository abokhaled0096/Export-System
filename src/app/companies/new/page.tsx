import Link from "next/link";
import { Button } from "@/components/ui/button";
import CompanyForm from "./CompanyForm";

export default function NewCompanyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/companies">← رجوع لقائمة الشركات</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">شركة جديدة</h1>
      <div className="mt-8">
        <CompanyForm />
      </div>
    </main>
  );
}
