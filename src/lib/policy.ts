// Normalized error classification and runtime decision helpers.
// Implements the contract from PRD sections 14, 17 and the error mapping in FR-8.

import type {
  FeatureBudget,
  NormalizedProviderError,
  ProviderBudgetSnapshot,
  ProviderHealthState,
  ProviderName,
} from "./types";

export type RuntimeDecision =
  | "allow"
  | "allow_with_cheaper_model"
  | "fallback_provider"
  | "queue"
  | "pause"
  | "block_with_graceful_message";

interface RawErrorLike {
  status?: number;
  code?: string;
  type?: string;
  message?: string;
}

// Maps provider-specific signals into the normalized error taxonomy (FR-8).
export function classifyError(
  provider: ProviderName,
  error: RawErrorLike,
): NormalizedProviderError {
  const status = error.status;
  const code = (error.code ?? error.type ?? "").toLowerCase();

  if (status === 401 || status === 403 || code.includes("auth")) return "AUTH_FAILED";
  if (status === 402) return "INSUFFICIENT_CREDITS";
  if (status === 429) return "RATE_LIMITED";
  if (status === 413 || code.includes("too_large")) return "REQUEST_TOO_LARGE";
  if (status && status >= 500) return "PROVIDER_DOWN";

  if (code.includes("insufficient") || code.includes("credit")) return "INSUFFICIENT_CREDITS";
  if (code.includes("billing") || code.includes("quota") || code.includes("budget"))
    return "MONTHLY_BUDGET_EXCEEDED";
  if (code.includes("rate") || code.includes("limit")) return "RATE_LIMITED";
  if (code.includes("safety") || code.includes("content_policy")) return "SAFETY_BLOCKED";
  if (code.includes("model")) return "MODEL_UNAVAILABLE";

  return "UNKNOWN_PROVIDER_ERROR";
}

// Whether a normalized error is safe to retry (FR-8 / section 24 reliability).
export function isRetryable(error: NormalizedProviderError): boolean {
  // Billing / credit / quota errors must never be retried blindly.
  return error === "RATE_LIMITED" || error === "PROVIDER_DOWN";
}

// Decides what the gateway should do for a feature given current provider health
// and feature budget. Simplified version of the budget policy engine (FR-7).
export function evaluateDecision(
  feature: FeatureBudget,
  snapshot: ProviderBudgetSnapshot,
): RuntimeDecision {
  const overBudget = feature.currentMonthlyUsageUsd >= feature.monthlyBudgetUsd;
  const state = snapshot.state;

  if (overBudget) {
    return feature.priority === "critical" ? "allow_with_cheaper_model" : behaviorToDecision(feature);
  }

  if (state === "emergency") {
    if (feature.priority === "critical") {
      return feature.fallbackProviders.length > 0 ? "fallback_provider" : "allow_with_cheaper_model";
    }
    return "block_with_graceful_message";
  }

  if (state === "critical") {
    if (feature.priority === "critical" || feature.priority === "high") {
      return feature.lowBudgetBehavior === "switch_to_cheaper_model"
        ? "allow_with_cheaper_model"
        : "allow";
    }
    return behaviorToDecision(feature);
  }

  if (state === "rate_limited") {
    return feature.fallbackProviders.length > 0 ? "fallback_provider" : "queue";
  }

  return "allow";
}

function behaviorToDecision(feature: FeatureBudget): RuntimeDecision {
  switch (feature.lowBudgetBehavior) {
    case "queue_jobs":
      return "queue";
    case "switch_to_cheaper_model":
      return "allow_with_cheaper_model";
    case "pause":
    case "disable":
      return "pause";
    default:
      return "block_with_graceful_message";
  }
}

// Recomputes a provider health state from a snapshot and thresholds (sections 9 / 16).
export function computeProviderState(
  snapshot: ProviderBudgetSnapshot,
  thresholds: {
    warningThresholdUsd?: number;
    criticalThresholdUsd?: number;
    emergencyThresholdUsd?: number;
    warnPercent?: number;
    criticalPercent?: number;
    emergencyPercent?: number;
  },
): ProviderHealthState {
  if (snapshot.remainingCreditsUsd !== undefined) {
    const r = snapshot.remainingCreditsUsd;
    if (r <= (thresholds.emergencyThresholdUsd ?? 1)) return "emergency";
    if (r <= (thresholds.criticalThresholdUsd ?? 5)) return "critical";
    if (r <= (thresholds.warningThresholdUsd ?? 20)) return "warning";
    return "healthy";
  }

  if (snapshot.monthToDateSpendUsd !== undefined && snapshot.monthlyBudgetUsd) {
    const pct = (snapshot.monthToDateSpendUsd / snapshot.monthlyBudgetUsd) * 100;
    if (pct >= (thresholds.emergencyPercent ?? 100)) return "emergency";
    if (pct >= (thresholds.criticalPercent ?? 90)) return "critical";
    if (pct >= (thresholds.warnPercent ?? 70)) return "warning";
    return "healthy";
  }

  return "unknown";
}
