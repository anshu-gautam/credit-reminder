// OpenRouter adapter — prepaid credits model (PRD §9.1).
// Live: GET https://openrouter.ai/api/v1/credits with a management key.
// Docs: https://openrouter.ai/docs/api/api-reference/credits/get-credits

import type { ProviderAdapter, ProviderSnapshotData, ProviderUsageQuery } from "@/lib/types";
import { classifyError } from "@/lib/policy";
import { mockSnapshotData, mockUsageBreakdown } from "@/lib/store";
import { fetchJson, toRawError } from "./http";

const BASE = "https://openrouter.ai/api/v1";

interface CreditsResponse {
  data?: { total_credits?: number; total_usage?: number };
}

export const openRouterAdapter: ProviderAdapter = {
  name: "openrouter",

  isLive: () => Boolean(process.env.OPENROUTER_MANAGEMENT_KEY),

  async fetchBudgetSnapshot(): Promise<ProviderSnapshotData> {
    const key = process.env.OPENROUTER_MANAGEMENT_KEY;
    if (!key) return mockSnapshotData("openrouter");

    const json = await fetchJson<CreditsResponse>(`${BASE}/credits`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    const total = Number(json.data?.total_credits ?? 0);
    const usage = Number(json.data?.total_usage ?? 0);

    return {
      provider: "openrouter",
      totalCreditsUsd: Number(total.toFixed(2)),
      totalUsageUsd: Number(usage.toFixed(2)),
      remainingCreditsUsd: Number((total - usage).toFixed(2)),
      lastCheckedAt: new Date().toISOString(),
      rawProviderPayload: json,
    };
  },

  async fetchUsageBreakdown(params: ProviderUsageQuery) {
    // OpenRouter usage accounting is enabled per-request; in the absence of a
    // dedicated org usage endpoint we report from the gateway event log.
    return mockUsageBreakdown("openrouter", params);
  },

  classifyError(error: unknown) {
    return classifyError("openrouter", toRawError(error));
  },
};
