// Anthropic adapter — monthly usage with spend limit (PRD §9.3).
// Live: GET https://api.anthropic.com/v1/organizations/cost_report with an admin key.
// Docs: https://platform.claude.com/docs/en/api/admin/cost_report/retrieve

import type { ProviderAdapter, ProviderSnapshotData, ProviderUsageQuery } from "@/lib/types";
import { classifyError } from "@/lib/policy";
import { mockSnapshotData, mockUsageBreakdown } from "@/lib/store";
import { fetchJson, startOfMonth, sumAmounts, toRawError } from "./http";

const BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

export const anthropicAdapter: ProviderAdapter = {
  name: "anthropic",

  isLive: () => Boolean(process.env.ANTHROPIC_ADMIN_KEY),

  async fetchBudgetSnapshot(): Promise<ProviderSnapshotData> {
    const key = process.env.ANTHROPIC_ADMIN_KEY;
    if (!key) return mockSnapshotData("anthropic");

    const startingAt = startOfMonth().toISOString();
    const json = await fetchJson<unknown>(
      `${BASE}/organizations/cost_report?starting_at=${encodeURIComponent(startingAt)}`,
      {
        headers: {
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_VERSION,
        },
      },
    );

    const spend = Number(sumAmounts(json).toFixed(2));
    const budget = Number(process.env.ANTHROPIC_MONTHLY_BUDGET_USD ?? 1000);

    return {
      provider: "anthropic",
      monthToDateSpendUsd: spend,
      monthlyBudgetUsd: budget,
      monthlySpendLimitUsd: budget,
      remainingMonthlyBudgetUsd: Number((budget - spend).toFixed(2)),
      lastCheckedAt: new Date().toISOString(),
      rawProviderPayload: json,
    };
  },

  async fetchUsageBreakdown(params: ProviderUsageQuery) {
    return mockUsageBreakdown("anthropic", params);
  },

  classifyError(error: unknown) {
    return classifyError("anthropic", toRawError(error));
  },
};
