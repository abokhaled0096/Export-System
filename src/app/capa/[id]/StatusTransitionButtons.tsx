"use client";

import { useState, useTransition } from "react";
import { updateCAPAStatusAction } from "../actions";
import { CAPA_ALL_STATUSES } from "@/lib/capaLabels";
import { capaStatusLabel, CAPA_STATUS_TRANSITIONS } from "@/lib/capaLabels";
import { Button } from "@/components/ui/button";

type Status = (typeof CAPA_ALL_STATUSES)[number];

export default function StatusTransitionButtons({ capaId, status }: { capaId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allowed = (CAPA_STATUS_TRANSITIONS[status] ?? []) as Status[];

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
