import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { overallState, providerRegistry } from "@/lib/store";
import { pollAndAlert } from "@/lib/providers";
import type { ProviderStatusResponse } from "@/lib/types";

// GET /admin/ai/providers/status  (PRD §10 FR-10, §20.1)
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  // Poll adapters (live when keys are configured, mock otherwise), run the alert
  // engine over the result, and refresh the snapshot cache.
  const { snapshots } = await pollAndAlert();
  const body: ProviderStatusResponse = {
    overallState: overallState(),
    providers: snapshots.map((s) => {
      const reg = providerRegistry.find((r) => r.name === s.provider)!;
      return {
        provider: s.provider,
        displayName: reg.displayName,
        billingType: reg.billingType,
        state: s.state,
        enabled: reg.enabled,
        remainingCreditsUsd: s.remainingCreditsUsd,
        totalCreditsUsd: s.totalCreditsUsd,
        totalUsageUsd: s.totalUsageUsd,
        monthToDateSpendUsd: s.monthToDateSpendUsd,
        monthlyBudgetUsd: s.monthlyBudgetUsd,
        monthlySpendLimitUsd: s.monthlySpendLimitUsd,
        remainingMonthlyBudgetUsd: s.remainingMonthlyBudgetUsd,
        estimatedHoursRemaining: s.estimatedHoursRemaining,
        lastCheckedAt: s.lastCheckedAt,
        topFeature: s.topFeature,
        topModel: s.topModel,
      };
    }),
  };

  return NextResponse.json(body);
}
