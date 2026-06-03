import { NextResponse } from "next/server";

import { featureBudgets } from "@/lib/store";
import type { FeatureStatusResponse } from "@/lib/types";

// GET /admin/ai/features/status  (PRD §10 FR-10, §20.2)
export async function GET() {
  const body: FeatureStatusResponse = {
    features: featureBudgets.map((f) => ({
      name: f.featureName,
      priority: f.priority,
      state: f.state,
      monthToDateSpendUsd: f.currentMonthlyUsageUsd,
      monthlyBudgetUsd: f.monthlyBudgetUsd,
      currentProvider: f.currentProvider,
      owner: f.owner,
    })),
  };

  return NextResponse.json(body);
}
