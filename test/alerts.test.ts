import { test } from "node:test";
import assert from "node:assert/strict";

import { buildProviderAlert, shouldSend } from "@/lib/alerts/engine";
import { channelsForSeverity } from "@/lib/alerts/channels";
import type { ProviderBudgetSnapshot } from "@/lib/types";

test("shouldSend: emergencies always send", () => {
  const dedupe = { "k": new Date().toISOString() };
  assert.equal(shouldSend("k", "emergency", Date.now(), dedupe), true);
});

test("shouldSend: warning suppressed within window, re-fires after", () => {
  const now = Date.now();
  const dedupe = { k: new Date(now - 60_000).toISOString() }; // 1 min ago
  assert.equal(shouldSend("k", "warning", now, dedupe), false); // window is 6h
  const old = { k: new Date(now - 7 * 60 * 60 * 1000).toISOString() }; // 7h ago
  assert.equal(shouldSend("k", "warning", now, old), true);
});

test("shouldSend: first occurrence always sends", () => {
  assert.equal(shouldSend("new-key", "critical", Date.now(), {}), true);
});

// PRD §11 escalation: emergency fans out to slack+email+pagerduty.
test("channelsForSeverity: emergency escalates to pagerduty", () => {
  assert.deepEqual(channelsForSeverity("emergency"), ["slack", "email", "pagerduty"]);
  assert.deepEqual(channelsForSeverity("warning"), ["slack", "email"]);
});

test("buildProviderAlert: critical prepaid maps to budget_critical", () => {
  const snap: ProviderBudgetSnapshot = {
    provider: "openrouter",
    state: "critical",
    remainingCreditsUsd: 4.72,
    lastCheckedAt: "x",
  };
  const alert = buildProviderAlert(snap, {
    name: "openrouter",
    displayName: "OpenRouter",
    enabled: true,
    billingType: "prepaid_credits",
    priority: 1,
    pollIntervalMinutes: 5,
    criticalThresholdUsd: 5,
    lastPolledAt: "x",
    consecutivePollingFailures: 0,
  });
  assert.ok(alert);
  assert.equal(alert!.severity, "critical");
  assert.equal(alert!.alertType, "provider_budget_critical");
  assert.equal(alert!.dedupeKey, "provider:openrouter:provider_budget_critical");
  assert.equal(alert!.thresholdValueUsd, 5);
});

test("buildProviderAlert: healthy returns null", () => {
  const snap: ProviderBudgetSnapshot = { provider: "openai", state: "healthy", lastCheckedAt: "x" };
  assert.equal(buildProviderAlert(snap), null);
});
