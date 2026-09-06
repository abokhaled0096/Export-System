"use client";

import { useState, useTransition } from "react";
import { updateOpportunityStageAction } from "../actions";
import { opportunityStageLabel, OPPORTUNITY_STAGE_TRANSITIONS, OPPORTUNITY_ALL_STAGES } from "@/lib/opportunityLabels";
import { Button } from "@/components/ui/button";

type Stage = (typeof OPPORTUNITY_ALL_STAGES)[number];

export default function StageTransitionButtons({ opportunityId, stage }: { opportunityId: string; stage: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allowed = (OPPORTUNITY_STAGE_TRANSITIONS[stage] ?? []) as Stage[];

  if (allowed.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowed.map((next) => (
        <Button
          key={next}
          size="sm"
          variant={next === "Lost" ? "outline" : "default"}
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await updateOpportunityStageAction(opportunityId, next);
              } catch (e) {
                setError(e instanceof Error ? e.message : "حصل خطأ.");
              }
            });
          }}
        >
          {pending ? "..." : `→ ${opportunityStageLabel[next]}`}
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
