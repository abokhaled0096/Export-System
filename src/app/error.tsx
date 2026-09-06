"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-foreground">حصل خطأ غير متوقّع</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        حاول تاني، ولو المشكلة استمرت ابلّغ الدعم الفني برقم المرجع ده.
      </p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground/70">{error.digest}</p>}
      <div className="mt-2 flex gap-3">
        <Button onClick={() => reset()}>حاول تاني</Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/">رجوع للوحة القيادة</Link>} />
      </div>
    </main>
  );
}
