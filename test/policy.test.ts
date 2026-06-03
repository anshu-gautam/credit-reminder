import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyError,
  computeProviderState,
  evaluateDecision,
  isRetryable,
} from "@/lib/policy";
import type { FeatureBudget, ProviderBudgetSnapshot } from "@/lib/types";

const prepaidThresholds = {
  warningThresholdUsd: 20,
  criticalThresholdUsd: 5,
  emergencyThresholdUsd: 1,
};
const monthlyThresholds = { warnPercent: 70, criticalPercent: 90, emergencyPercent: 100 };

function feature(overrides: Partial<FeatureBudget> = {}): FeatureBudget {
  return {
    featureName: "f",
    priority: "low",
    monthlyBudgetUsd: 100,
    currentDailyUsageUsd: 0,
    currentMonthlyUsageUsd: 0,
    allowedProviders: ["openrouter"],
    preferredProvider: "openrouter",
    fallbackProviders: [],
    lowBudgetBehavior: "pause",
    state: "enabled",
    currentProvider: "openrouter",
    updatedAt: "2026-06-03T00:00:00Z",
    ...overrides,
  };
}

function snap(overrides: Partial<ProviderBudgetSnapshot> = {}): ProviderBudgetSnapshot {
  return {
    provider: "openrouter",
    state: "healthy",
    lastCheckedAt: "2026-06-03T00:00:00Z",
    ...overrides,
  };
}

// PRD TC1: OpenRouter warning threshold.
test("computeProviderState: prepaid warning band", () => {
  assert.equal(
    computeProviderState(snap({ remainingCreditsUsd: 19.5 }), prepaidThresholds),
    "warning",
  );
});

test("computeProviderState: prepaid critical and emergency bands", () => {
  assert.equal(computeProviderState(snap({ remainingCreditsUsd: 4.72 }), prepaidThresholds), "critical");
  assert.equal(computeProviderState(snap({ remainingCreditsUsd: 0.5 }), prepaidThresholds), "emergency");
  assert.equal(computeProviderState(snap({ remainingCreditsUsd: 50 }), prepaidThresholds), "healthy");
});

// PRD TC3/TC4: monthly spend bands.
test("computeProviderState: monthly percent bands", () => {
  const base = { provider: "openai" as const, state: "healthy" as const, lastCheckedAt: "x", monthlyBudgetUsd: 1000 };
  assert.equal(computeProviderState({ ...base, monthToDateSpendUsd: 720 }, monthlyThresholds), "warning");
  assert.equal(computeProviderState({ ...base, monthToDateSpendUsd: 910 }, monthlyThresholds), "critical");
  assert.equal(computeProviderState({ ...base, monthToDateSpendUsd: 1000 }, monthlyThresholds), "emergency");
});

// PRD TC2: HTTP 402 -> INSUFFICIENT_CREDITS, not retryable.
test("classifyError: 402 is INSUFFICIENT_CREDITS and not retryable", () => {
  const err = classifyError("openrouter", { status: 402 });
  assert.equal(err, "INSUFFICIENT_CREDITS");
  assert.equal(isRetryable(err), false);
});

// PRD TC5: HTTP 429 -> RATE_LIMITED, retryable.
test("classifyError: 429 is RATE_LIMITED and retryable", () => {
  const err = classifyError("anthropic", { status: 429 });
  assert.equal(err, "RATE_LIMITED");
  assert.equal(isRetryable(err), true);
});

test("classifyError: auth + billing mapping", () => {
  assert.equal(classifyError("openai", { status: 401 }), "AUTH_FAILED");
  assert.equal(classifyError("openai", { code: "billing_hard_limit_reached" }), "MONTHLY_BUDGET_EXCEEDED");
  assert.equal(isRetryable("MONTHLY_BUDGET_EXCEEDED"), false);
});

// PRD TC6: feature over budget is paused for a low-priority feature.
test("evaluateDecision: low-priority over-budget pauses", () => {
  const f = feature({ currentMonthlyUsageUsd: 201, monthlyBudgetUsd: 200, lowBudgetBehavior: "pause" });
  assert.equal(evaluateDecision(f, snap()), "pause");
});

// Critical feature degrades rather than blocks in emergency.
test("evaluateDecision: critical feature degrades in emergency", () => {
  const f = feature({ priority: "critical", lowBudgetBehavior: "switch_to_cheaper_model" });
  assert.equal(evaluateDecision(f, snap({ state: "emergency" })), "allow_with_cheaper_model");
});

test("evaluateDecision: low-priority blocked in emergency", () => {
  const f = feature({ priority: "low" });
  assert.equal(evaluateDecision(f, snap({ state: "emergency" })), "block_with_graceful_message");
});

test("evaluateDecision: healthy allows", () => {
  assert.equal(evaluateDecision(feature(), snap({ state: "healthy" })), "allow");
});

// High-priority feature with queue_jobs honors its behavior in a critical state.
test("evaluateDecision: high-priority queue_jobs queues in critical", () => {
  const f = feature({ priority: "high", lowBudgetBehavior: "queue_jobs" });
  assert.equal(evaluateDecision(f, snap({ state: "critical" })), "queue");
});

// Critical-priority feature is force-kept running even in a critical state.
test("evaluateDecision: critical-priority kept running in critical", () => {
  const f = feature({ priority: "critical", lowBudgetBehavior: "queue_jobs" });
  assert.equal(evaluateDecision(f, snap({ state: "critical" })), "allow");
});
