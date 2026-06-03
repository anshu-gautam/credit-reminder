// OpenAI adapter — monthly usage/cost model (PRD §9.2).
// Live: GET https://api.openai.com/v1/organization/costs with an admin key.
// Docs: https://developers.openai.com/api/reference/.../organization/usage/costs

import type { ProviderAdapter, ProviderSnapshotData, ProviderUsageQuery } from "@/lib/types";
import { classifyError } from "@/lib/policy";
import { mockSnapshotData, mockUsageBreakdown } from "@/lib/store";
import { fetchJson, startOfMonth, sumAmounts, toRawError } from "./http";

const BASE = "https://api.openai.com/v1";

export const openAiAdapter: ProviderAdapter = {
  name: "openai",

  isLive: () => Boolean(process.env.OPENAI_ADMIN_KEY),

  async fetchBudgetSnapshot(): Promise<ProviderSnapshotData> {
    const key = process.env.OPENAI_ADMIN_KEY;
    if (!key) return mockSnapshotData("openai");

    const startTime = Math.floor(startOfMonth().getTime() / 1000);
    const json = await fetchJson<unknown>(
      `${BASE}/organization/costs?start_time=${startTime}&limit=180`,
      { headers: { Authorization: `Bearer ${key}` } },
    );

    // Costs endpoint returns paginated buckets, each with results[].amount.value.
    const spend = Number(sumAmounts(json).toFixed(2));
    const budget = Number(process.env.OPENAI_MONTHLY_BUDGET_USD ?? 1000);

    return {
      provider: "openai",
      monthToDateSpendUsd: spend,
      monthlyBudgetUsd: budget,
      remainingMonthlyBudgetUsd: Number((budget - spend).toFixed(2)),
      lastCheckedAt: new Date().toISOString(),
      rawProviderPayload: json,
    };
  },

  async fetchUsageBreakdown(params: ProviderUsageQuery) {
    return mockUsageBreakdown("openai", params);
  },

  classifyError(error: unknown) {
    return classifyError("openai", toRawError(error));
  },
};
