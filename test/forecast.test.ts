import { test } from "node:test";
import assert from "node:assert/strict";

import { burnRate, detectSpike, estimateHoursRemaining } from "@/lib/forecast";
import type { UsageEvent } from "@/lib/types";

const NOW = Date.UTC(2026, 5, 3, 12, 0, 0);

function evt(minutesAgo: number, cost: number): UsageEvent {
  return {
    id: `e${minutesAgo}`,
    requestId: "r",
    provider: "openrouter",
    model: "m",
    featureName: "f",
    apiKeyAlias: "a",
    environment: "production",
    priority: "low",
    requestCount: 1,
    estimatedCostUsd: cost,
    status: "success",
    createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  };
}

test("burnRate: hourly extrapolation from a window", () => {
  // $2 in the last 30 minutes => $4/hour.
  const events = [evt(5, 1), evt(20, 1), evt(90, 5)];
  const br = burnRate("openrouter", 30, events, NOW);
  assert.equal(br.spendUsd, 2);
  assert.equal(br.hourlyBurnUsd, 4);
});

test("estimateHoursRemaining: remaining / hourly burn", () => {
  assert.equal(estimateHoursRemaining({ remainingCreditsUsd: 20 }, 4), 5);
  assert.equal(estimateHoursRemaining({ remainingCreditsUsd: 20 }, 0), undefined);
  assert.equal(estimateHoursRemaining({ remainingMonthlyBudgetUsd: 100 }, 10), 10);
});

test("detectSpike: recent 15m far above baseline", () => {
  // Heavy spend in the last 15 minutes, almost nothing in the prior hour.
  const spiky = [evt(2, 5), evt(7, 5), evt(50, 0.1)];
  assert.equal(detectSpike("openrouter", 3, spiky, NOW), true);

  // Even load => no spike.
  const flat = Array.from({ length: 10 }, (_, i) => evt(i * 8, 1));
  assert.equal(detectSpike("openrouter", 3, flat, NOW), false);
});
