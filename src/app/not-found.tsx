import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-foreground">الصفحة أو العنصر غير موجود</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        الرابط ده غير موجود، أو العنصر اتمسح أو اتأرشف.
      </p>
      <Button nativeButton={false} render={<Link href="/">رجوع للوحة القيادة</Link>} />
    </main>
  );
}
