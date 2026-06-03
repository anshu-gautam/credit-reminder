// In-memory normalized data store seeded with representative data.
// In production this would be backed by the tables described in PRD section 19
// (ai_provider_budget_snapshots, ai_usage_events, ai_feature_budgets,
// ai_alert_events, ai_runtime_state_events). Here it powers the dashboard.

import type {
  AlertEvent,
  FeatureBudget,
  ProviderBudgetSnapshot,
  ProviderHealthState,
  ProviderName,
  ProviderRegistryEntry,
  UsageEvent,
} from "./types";
import { computeProviderState } from "./policy";

const now = Date.now();
const iso = (offsetMs = 0) => new Date(now - offsetMs).toISOString();

export const providerRegistry: ProviderRegistryEntry[] = [
  {
    name: "openrouter",
    displayName: "OpenRouter",
    enabled: true,
    billingType: "prepaid_credits",
    priority: 1,
    pollIntervalMinutes: 5,
    warningThresholdUsd: 20,
    criticalThresholdUsd: 5,
    emergencyThresholdUsd: 1,
    lastPolledAt: iso(45 * 1000),
    consecutivePollingFailures: 0,
  },
  {
    name: "openai",
    displayName: "OpenAI",
    enabled: true,
    billingType: "monthly_usage",
    priority: 2,
    pollIntervalMinutes: 10,
    warnPercent: 70,
    criticalPercent: 90,
    emergencyPercent: 100,
    lastPolledAt: iso(2 * 60 * 1000),
    consecutivePollingFailures: 0,
  },
  {
    name: "anthropic",
    displayName: "Anthropic",
    enabled: true,
    billingType: "monthly_usage_with_spend_limit",
    priority: 3,
    pollIntervalMinutes: 5,
    warnPercent: 70,
    criticalPercent: 90,
    emergencyPercent: 100,
    lastPolledAt: iso(80 * 1000),
    consecutivePollingFailures: 0,
  },
];

function thresholdsFor(provider: ProviderName) {
  const r = providerRegistry.find((p) => p.name === provider)!;
  return {
    warningThresholdUsd: r.warningThresholdUsd,
    criticalThresholdUsd: r.criticalThresholdUsd,
    emergencyThresholdUsd: r.emergencyThresholdUsd,
    warnPercent: r.warnPercent,
    criticalPercent: r.criticalPercent,
    emergencyPercent: r.emergencyPercent,
  };
}

// Raw snapshots carry only measured values; health state is derived from the
// thresholds in the registry so the policy engine is the single source of truth.
const rawSnapshots: Array<Omit<ProviderBudgetSnapshot, "state">> = [
  {
    provider: "openrouter",
    totalCreditsUsd: 100,
    totalUsageUsd: 95.28,
    remainingCreditsUsd: 4.72,
    lastCheckedAt: iso(45 * 1000),
    estimatedHoursRemaining: 3.1,
    topFeature: "background-enrichment",
    topModel: "anthropic/claude-3.5-sonnet",
  },
  {
    provider: "openai",
    monthToDateSpendUsd: 720,
    monthlyBudgetUsd: 1000,
    remainingMonthlyBudgetUsd: 280,
    lastCheckedAt: iso(2 * 60 * 1000),
    estimatedHoursRemaining: 96,
    topFeature: "main-chat",
    topModel: "gpt-4o",
  },
  {
    provider: "anthropic",
    monthToDateSpendUsd: 220,
    monthlyBudgetUsd: 1000,
    monthlySpendLimitUsd: 1000,
    remainingMonthlyBudgetUsd: 780,
    lastCheckedAt: iso(80 * 1000),
    estimatedHoursRemaining: 410,
    topFeature: "document-summary",
    topModel: "claude-3.5-sonnet",
  },
];

// Computed on each call so changes to registry thresholds (e.g. via the policy
// API) are reflected immediately, keeping the threshold engine authoritative.
export function getSnapshots(): ProviderBudgetSnapshot[] {
  return rawSnapshots.map((s) => ({
    ...s,
    state: computeProviderState(s as ProviderBudgetSnapshot, thresholdsFor(s.provider)),
  }));
}

export const featureBudgets: FeatureBudget[] = [
  {
    featureName: "main-chat",
    priority: "critical",
    dailyBudgetUsd: 50,
    monthlyBudgetUsd: 1000,
    currentDailyUsageUsd: 18.4,
    currentMonthlyUsageUsd: 320.5,
    allowedProviders: ["openrouter", "openai", "anthropic"],
    preferredProvider: "openrouter",
    fallbackProviders: ["openai", "anthropic"],
    lowBudgetBehavior: "switch_to_cheaper_model",
    state: "enabled",
    currentProvider: "openrouter",
    owner: "core-product",
    updatedAt: iso(5 * 60 * 1000),
  },
  {
    featureName: "document-summary",
    priority: "high",
    dailyBudgetUsd: 20,
    monthlyBudgetUsd: 400,
    currentDailyUsageUsd: 9.2,
    currentMonthlyUsageUsd: 188.7,
    allowedProviders: ["openrouter", "anthropic"],
    preferredProvider: "openrouter",
    fallbackProviders: ["anthropic"],
    lowBudgetBehavior: "queue_jobs",
    state: "enabled",
    currentProvider: "anthropic",
    owner: "documents-team",
    updatedAt: iso(7 * 60 * 1000),
  },
  {
    featureName: "background-enrichment",
    priority: "low",
    dailyBudgetUsd: 10,
    monthlyBudgetUsd: 200,
    currentDailyUsageUsd: 9.9,
    currentMonthlyUsageUsd: 198.9,
    allowedProviders: ["openrouter"],
    preferredProvider: "openrouter",
    fallbackProviders: [],
    lowBudgetBehavior: "pause",
    state: "paused",
    currentProvider: "openrouter",
    owner: "growth-ops",
    updatedAt: iso(3 * 60 * 1000),
  },
  {
    featureName: "agent-workflow",
    priority: "high",
    dailyBudgetUsd: 30,
    monthlyBudgetUsd: 600,
    currentDailyUsageUsd: 12.1,
    currentMonthlyUsageUsd: 254.3,
    allowedProviders: ["openai", "anthropic"],
    preferredProvider: "anthropic",
    fallbackProviders: ["openai"],
    lowBudgetBehavior: "switch_to_cheaper_model",
    state: "enabled",
    currentProvider: "anthropic",
    owner: "agents-team",
    updatedAt: iso(11 * 60 * 1000),
  },
];

export const alertEvents: AlertEvent[] = [
  {
    id: "alert_001",
    severity: "critical",
    alertType: "provider_budget_critical",
    provider: "openrouter",
    featureName: "background-enrichment",
    model: "anthropic/claude-3.5-sonnet",
    message: "OpenRouter remaining credits are below the $5.00 critical threshold.",
    currentValueUsd: 4.72,
    thresholdValueUsd: 5,
    dedupeKey: "openrouter:provider_budget_critical",
    sentTo: ["slack", "email"],
    sentAt: iso(6 * 60 * 1000),
    resolvedAt: null,
    recommendedAction:
      "Top up OpenRouter credits or raise the auto top-up threshold. Low-priority features have been paused.",
  },
  {
    id: "alert_002",
    severity: "warning",
    alertType: "provider_budget_warning",
    provider: "openai",
    featureName: "main-chat",
    model: "gpt-4o",
    message: "OpenAI month-to-date spend has reached 72% of the monthly budget.",
    currentValueUsd: 720,
    thresholdValueUsd: 700,
    dedupeKey: "openai:provider_budget_warning",
    sentTo: ["slack"],
    sentAt: iso(38 * 60 * 1000),
    resolvedAt: null,
    recommendedAction: "Review current usage and verify whether spend is expected.",
  },
  {
    id: "alert_003",
    severity: "emergency",
    alertType: "feature_budget_exceeded",
    provider: "openrouter",
    featureName: "background-enrichment",
    model: null,
    message:
      "background-enrichment reached its $200 monthly hard budget. Feature paused per low-budget policy.",
    currentValueUsd: 198.9,
    thresholdValueUsd: 200,
    dedupeKey: "feature:background-enrichment:budget_exceeded",
    sentTo: ["slack", "email", "pagerduty"],
    sentAt: iso(3 * 60 * 1000),
    resolvedAt: null,
    recommendedAction: "Increase the feature budget or keep it paused until next cycle.",
  },
  {
    id: "alert_004",
    severity: "recovery",
    alertType: "recovery",
    provider: "anthropic",
    featureName: "document-summary",
    model: "claude-3.5-sonnet",
    message: "Anthropic returned to healthy state after a transient rate-limit burst.",
    currentValueUsd: 220,
    thresholdValueUsd: null,
    dedupeKey: "anthropic:recovery",
    sentTo: ["slack"],
    sentAt: iso(52 * 60 * 1000),
    resolvedAt: iso(52 * 60 * 1000),
    recommendedAction: "Paused features will be restored gradually; queued jobs will drain.",
  },
  {
    id: "alert_005",
    severity: "warning",
    alertType: "provider_rate_limited",
    provider: "anthropic",
    featureName: "document-summary",
    model: "claude-3.5-sonnet",
    message: "Sustained HTTP 429 responses (18% failure rate over 5 minutes) from Anthropic.",
    currentValueUsd: null,
    thresholdValueUsd: null,
    dedupeKey: "anthropic:rate_limited",
    sentTo: ["slack"],
    sentAt: iso(58 * 60 * 1000),
    resolvedAt: iso(53 * 60 * 1000),
    recommendedAction: "Gateway reduced concurrency and enabled bounded backoff.",
  },
];

const features = ["main-chat", "document-summary", "background-enrichment", "agent-workflow"];
const models: Record<ProviderName, string[]> = {
  openrouter: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini", "google/gemini-1.5-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  anthropic: ["claude-3.5-sonnet", "claude-3.5-haiku"],
};
const providers: ProviderName[] = ["openrouter", "openai", "anthropic"];

// Deterministic pseudo-random generator so the seeded data is stable per build.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export const usageEvents: UsageEvent[] = (() => {
  const rand = seeded(42);
  const out: UsageEvent[] = [];
  for (let i = 0; i < 120; i++) {
    const provider = providers[Math.floor(rand() * providers.length)];
    const model = models[provider][Math.floor(rand() * models[provider].length)];
    const featureName = features[Math.floor(rand() * features.length)];
    const inputTokens = Math.floor(400 + rand() * 4000);
    const outputTokens = Math.floor(100 + rand() * 1500);
    const estimatedCostUsd = Number(
      ((inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.012).toFixed(4),
    );
    const roll = rand();
    const status: UsageEvent["status"] =
      roll > 0.94 ? "error" : roll > 0.9 ? "queued" : roll > 0.88 ? "blocked" : "success";
    out.push({
      id: `evt_${i.toString().padStart(4, "0")}`,
      requestId: `req_${Math.floor(rand() * 1_000_000)}`,
      provider,
      model,
      featureName,
      apiKeyAlias: `${provider}-${featureName.split("-")[0]}-prod`,
      environment: "production",
      priority: featureName === "main-chat" ? "critical" : featureName === "background-enrichment" ? "low" : "high",
      inputTokens,
      outputTokens,
      requestCount: 1,
      estimatedCostUsd,
      actualCostUsd: status === "success" ? estimatedCostUsd : undefined,
      status,
      normalizedError:
        status === "error"
          ? rand() > 0.5
            ? "RATE_LIMITED"
            : "INSUFFICIENT_CREDITS"
          : null,
      latencyMs: Math.floor(200 + rand() * 3000),
      customerId: rand() > 0.7 ? `cus_${Math.floor(rand() * 50)}` : null,
      createdAt: iso(Math.floor(rand() * 24 * 60 * 60 * 1000)),
    });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
})();

const stateRank: Record<ProviderHealthState, number> = {
  healthy: 0,
  unknown: 1,
  warning: 2,
  rate_limited: 3,
  critical: 4,
  provider_down: 5,
  auth_error: 6,
  emergency: 7,
};

export function overallState(): ProviderHealthState {
  return getSnapshots()
    .filter((s) => providerRegistry.find((p) => p.name === s.provider)?.enabled)
    .reduce<ProviderHealthState>(
      (worst, s) => (stateRank[s.state] > stateRank[worst] ? s.state : worst),
      "healthy",
    );
}
