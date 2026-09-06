import Link from "next/link";
import { Button } from "@/components/ui/button";
import MarketForm from "./MarketForm";

export default function NewMarketPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/markets">← رجوع لقائمة الأسواق</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">سوق جديد</h1>
      <div className="mt-8">
        <MarketForm />
      </div>
    </main>
  );
}
