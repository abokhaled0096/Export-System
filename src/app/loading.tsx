import { Loader2 } from "lucide-react";
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">جاري التحميل...</p>
      </div>
    </main>
  );
}
