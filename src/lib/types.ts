// Core type contracts for the AI Provider Budget & Availability Monitor.
// Mirrors the Provider Adapter Contract and data model described in the PRD.

export type ProviderName = "openrouter" | "openai" | "anthropic";

export type ProviderHealthState =
  | "healthy"
  | "warning"
  | "critical"
  | "emergency"
  | "rate_limited"
  | "auth_error"
  | "provider_down"
  | "unknown";

export type NormalizedProviderError =
  | "INSUFFICIENT_CREDITS"
  | "MONTHLY_BUDGET_EXCEEDED"
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "MODEL_UNAVAILABLE"
  | "PROVIDER_DOWN"
  | "REQUEST_TOO_LARGE"
  | "SAFETY_BLOCKED"
  | "UNKNOWN_PROVIDER_ERROR";

export type BillingType =
  | "prepaid_credits"
  | "monthly_usage"
  | "monthly_usage_with_spend_limit";

export type FeaturePriority = "critical" | "high" | "medium" | "low";

export type FeatureState = "enabled" | "degraded" | "paused" | "disabled";

export type LowBudgetBehavior =
  | "continue"
  | "switch_to_cheaper_model"
  | "queue_jobs"
  | "pause"
  | "disable";

export type AlertSeverity =
  | "info"
  | "warning"
  | "critical"
  | "emergency"
  | "recovery";

export type AlertType =
  | "provider_balance_low"
  | "provider_budget_warning"
  | "provider_budget_critical"
  | "provider_budget_exhausted"
  | "provider_rate_limited"
  | "provider_quota_exceeded"
  | "provider_auth_failed"
  | "provider_payment_failed"
  | "provider_polling_failed"
  | "feature_budget_exceeded"
  | "model_spend_spike"
  | "fallback_activated"
  | "recovery";

export interface ProviderBudgetSnapshot {
  provider: ProviderName;

  // Prepaid-credit providers, for example OpenRouter.
  totalCreditsUsd?: number;
  totalUsageUsd?: number;
  remainingCreditsUsd?: number;

  // Monthly-billing providers, for example OpenAI and Anthropic.
  monthToDateSpendUsd?: number;
  monthlyBudgetUsd?: number;
  monthlySpendLimitUsd?: number;
  remainingMonthlyBudgetUsd?: number;

  // Common fields.
  state: ProviderHealthState;
  lastCheckedAt: string;
  estimatedHoursRemaining?: number;
  topFeature?: string;
  topModel?: string;
  rawProviderPayload?: unknown;
}

export interface ProviderUsageBreakdown {
  provider: ProviderName;
  feature?: string;
  model?: string;
  apiKeyAlias?: string;
  projectId?: string;
  workspaceId?: string;
  customerId?: string;
  inputTokens?: number;
  outputTokens?: number;
  requestCount?: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  startTime: string;
  endTime: string;
}

export interface ProviderRegistryEntry {
  name: ProviderName;
  displayName: string;
  enabled: boolean;
  billingType: BillingType;
  priority: number;
  pollIntervalMinutes: number;
  warningThresholdUsd?: number;
  criticalThresholdUsd?: number;
  emergencyThresholdUsd?: number;
  warnPercent?: number;
  criticalPercent?: number;
  emergencyPercent?: number;
  lastPolledAt: string;
  consecutivePollingFailures: number;
}

export interface FeatureBudget {
  featureName: string;
  priority: FeaturePriority;
  dailyBudgetUsd?: number;
  monthlyBudgetUsd: number;
  currentDailyUsageUsd: number;
  currentMonthlyUsageUsd: number;
  allowedProviders: ProviderName[];
  preferredProvider: ProviderName;
  fallbackProviders: ProviderName[];
  lowBudgetBehavior: LowBudgetBehavior;
  state: FeatureState;
  currentProvider: ProviderName;
  owner?: string;
  updatedAt: string;
}

export interface AlertEvent {
  id: string;
  severity: AlertSeverity;
  alertType: AlertType;
  provider?: ProviderName | null;
  featureName?: string | null;
  model?: string | null;
  message: string;
  currentValueUsd?: number | null;
  thresholdValueUsd?: number | null;
  dedupeKey: string;
  sentTo: string[];
  sentAt: string;
  resolvedAt?: string | null;
  recommendedAction?: string;
}

export interface UsageEvent {
  id: string;
  requestId: string;
  provider: ProviderName;
  model: string;
  featureName: string;
  apiKeyAlias: string;
  environment: "production" | "staging" | "dev";
  priority: FeaturePriority;
  inputTokens?: number;
  outputTokens?: number;
  requestCount: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  status: "success" | "error" | "queued" | "blocked";
  normalizedError?: NormalizedProviderError | null;
  latencyMs?: number;
  customerId?: string | null;
  createdAt: string;
}

export interface ProviderStatusResponse {
  overallState: ProviderHealthState;
  providers: Array<{
    provider: ProviderName;
    displayName: string;
    billingType: BillingType;
    state: ProviderHealthState;
    enabled: boolean;
    remainingCreditsUsd?: number;
    totalCreditsUsd?: number;
    totalUsageUsd?: number;
    monthToDateSpendUsd?: number;
    monthlyBudgetUsd?: number;
    monthlySpendLimitUsd?: number;
    remainingMonthlyBudgetUsd?: number;
    estimatedHoursRemaining?: number;
    lastCheckedAt: string;
    topFeature?: string;
    topModel?: string;
  }>;
}

export interface FeatureStatusResponse {
  features: Array<{
    name: string;
    priority: FeaturePriority;
    state: FeatureState;
    monthToDateSpendUsd: number;
    monthlyBudgetUsd: number;
    currentProvider: ProviderName;
    owner?: string;
  }>;
}
