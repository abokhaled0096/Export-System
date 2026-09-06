"use client";

import { useState, useTransition } from "react";
import { linkInvoiceDocumentAction } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DocumentOption = { id: string; label: string };

export default function LinkDocumentForm({ invoiceId, documents }: { invoiceId: string; documents: DocumentOption[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState("");

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        مفيش مستندات معتمدة من بوابة الضرائب (ETA) متاحة للربط — اعتمد المستند الأول من صفحة الصفقة.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={documentId} onValueChange={(v) => setDocumentId(String(v))}>
        <SelectTrigger className="w-64">
          <SelectValue>{(value: string) => documents.find((d) => d.id === value)?.label ?? "— اختر مستند معتمد —"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {documents.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        disabled={pending || !documentId}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await linkInvoiceDocumentAction(invoiceId, documentId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "ربط المستند"}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
