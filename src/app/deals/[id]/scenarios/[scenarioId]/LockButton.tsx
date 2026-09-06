"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { lockScenario, type LockScenarioState } from "../../../actions";
import { Button } from "@/components/ui/button";

const initialState: LockScenarioState = {};

export default function LockButton({
  scenarioId,
  disabled,
  lockVersion,
}: {
  scenarioId: string;
  disabled: boolean;
  lockVersion: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(lockScenario.bind(null, scenarioId), initialState);

  useEffect(() => {
    if (!pending && !state.formError && state !== initialState) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  return (
    <form action={formAction}>
      <input type="hidden" name="expectedLockVersion" value={lockVersion} />
      <Button
        type="submit"
        variant="secondary"
        disabled={disabled || pending}
        title={disabled ? "محتاج بند تكلفة واحد على الأقل قبل القفل" : undefined}
      >
        {pending ? "جاري القفل..." : "قفل السيناريو"}
      </Button>
      {state.formError && <p role="alert" className="mt-1 text-xs text-rose-600">{state.formError}</p>}
    </form>
  );
}
