"use client";

import { useState, useTransition } from "react";
import { updateCAPAStatusAction } from "../actions";
import { CAPA_ALL_STATUSES, capaStatusLabel } from "@/lib/capaLabels";
import { Button } from "@/components/ui/button";

type Status = (typeof CAPA_ALL_STATUSES)[number];

/** allowedStatuses بيوصل جاهز من الصفحة (Server Component) — بقى مصدره جدول WorkflowDefinition
 * (وحدة 9) بدل خريطة TS ثابتة، وde client component مايقدرش يستعلم القاعدة مباشرة. */
export default function StatusTransitionButtons({
  capaId,
  allowedStatuses,
}: {
  capaId: string;
  allowedStatuses: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allowed = allowedStatuses as Status[];

  if (allowed.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowed.map((next) => (
        <Button
          key={next}
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await updateCAPAStatusAction(capaId, next);
              } catch (e) {
                setError(e instanceof Error ? e.message : "حصل خطأ.");
              }
            });
          }}
        >
          {pending ? "..." : `→ ${capaStatusLabel[next]}`}
        </Button>
      ))}
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
