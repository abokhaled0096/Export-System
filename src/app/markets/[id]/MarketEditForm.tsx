"use client";

import { useActionState } from "react";
import { updateMarket, type UpdateMarketFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UpdateMarketFormState = {};

export default function MarketEditForm({
  marketId,
  tradeAgreement,
  politicalRiskScore,
  logisticsRiskScore,
}: {
  marketId: string;
  tradeAgreement: string | null;
  politicalRiskScore: number | null;
  logisticsRiskScore: number | null;
}) {
  const updateMarketWithId = updateMarket.bind(null, marketId);
  const [state, formAction, pending] = useActionState(updateMarketWithId, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tradeAgreement">اتفاقية تجارية</Label>
        <Input id="tradeAgreement" name="tradeAgreement" defaultValue={tradeAgreement ?? ""} />
        {state.errors?.tradeAgreement && <span className="text-xs text-destructive">{state.errors.tradeAgreement[0]}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="politicalRiskScore">درجة المخاطرة السياسية (0-100)</Label>
          <Input id="politicalRiskScore" name="politicalRiskScore" type="number" min="0" max="100" defaultValue={politicalRiskScore ?? ""} />
          {state.errors?.politicalRiskScore && <span className="text-xs text-destructive">{state.errors.politicalRiskScore[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="logisticsRiskScore">درجة المخاطرة اللوجستية (0-100)</Label>
          <Input id="logisticsRiskScore" name="logisticsRiskScore" type="number" min="0" max="100" defaultValue={logisticsRiskScore ?? ""} />
          {state.errors?.logisticsRiskScore && <span className="text-xs text-destructive">{state.errors.logisticsRiskScore[0]}</span>}
        </div>
      </div>

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ التقييم"}
      </Button>
    </form>
  );
}
