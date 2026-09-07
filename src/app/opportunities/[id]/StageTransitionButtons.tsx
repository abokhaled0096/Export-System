"use client";

import { useState, useTransition } from "react";
import { updateOpportunityStageAction } from "../actions";
import { opportunityStageLabel, OPPORTUNITY_ALL_STAGES } from "@/lib/opportunityLabels";
import { Button } from "@/components/ui/button";

type Stage = (typeof OPPORTUNITY_ALL_STAGES)[number];

/** allowedStages بيوصل جاهز من الصفحة (Server Component) — بقى مصدره جدول WorkflowDefinition
 * (وحدة 9) بدل خريطة TS ثابتة، وde client component مايقدرش يستعلم القاعدة مباشرة. */
export default function StageTransitionButtons({
  opportunityId,
  allowedStages,
}: {
  opportunityId: string;
  allowedStages: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allowed = allowedStages as Stage[];

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
