// Burn-rate and time-to-exhaustion forecasting (PRD §15 FR-12).
// Uses the gateway usage log as the fastest signal.

import { usageEvents } from "./store";
import type { ProviderBudgetSnapshot, ProviderName, UsageEvent } from "./types";

export interface BurnRate {
  windowMinutes: number;
  spendUsd: number;
  hourlyBurnUsd: number;
}

function spendInWindow(
  provider: ProviderName,
  windowMinutes: number,
  events: UsageEvent[] = usageEvents,
  nowMs = Date.now(),
): number {
  const cutoff = nowMs - windowMinutes * 60_000;
  let spend = 0;
  for (const e of events) {
    if (e.provider !== provider) continue;
    if (new Date(e.createdAt).getTime() < cutoff) continue;
    spend += e.estimatedCostUsd ?? 0;
  }
  return Number(spend.toFixed(4));
}

export function burnRate(
  provider: ProviderName,
  windowMinutes: number,
  events: UsageEvent[] = usageEvents,
  nowMs = Date.now(),
): BurnRate {
  const spendUsd = spendInWindow(provider, windowMinutes, events, nowMs);
  const hourlyBurnUsd = Number(((spendUsd / windowMinutes) * 60).toFixed(4));
  return { windowMinutes, spendUsd, hourlyBurnUsd };
}

// estimated_hours_remaining = remaining_budget / hourly_burn  (PRD §15)
export function estimateHoursRemaining(
  snapshot: Pick<ProviderBudgetSnapshot, "remainingCreditsUsd" | "remainingMonthlyBudgetUsd">,
  hourlyBurnUsd: number,
): number | undefined {
  const remaining = snapshot.remainingCreditsUsd ?? snapshot.remainingMonthlyBudgetUsd;
  if (remaining == null || hourlyBurnUsd <= 0) return undefined;
  return Number((remaining / hourlyBurnUsd).toFixed(1));
}

// Current 15-minute spend is more than `multiplier`x the recent hourly baseline.
export function detectSpike(
  provider: ProviderName,
  multiplier = 3,
  events: UsageEvent[] = usageEvents,
  nowMs = Date.now(),
): boolean {
  const recent15 = burnRate(provider, 15, events, nowMs).hourlyBurnUsd;
  // Baseline: the hour preceding the last 15 minutes.
  const baselineSpend = spendInWindow(provider, 75, events, nowMs) - spendInWindow(provider, 15, events, nowMs);
  const baselineHourly = (baselineSpend / 60) * 60; // spend over 60 min => hourly
  if (baselineHourly <= 0) return recent15 > 0;
  return recent15 > baselineHourly * multiplier;
}

export interface ProviderForecast {
  provider: ProviderName;
  windows: BurnRate[];
  estimatedHoursRemaining?: number;
  spike: boolean;
  fastBurnWarning: boolean; // projected exhaustion within 24h
  fastBurnCritical: boolean; // projected exhaustion within 6h
}

export function forecastProvider(
  snapshot: ProviderBudgetSnapshot,
  events: UsageEvent[] = usageEvents,
  nowMs = Date.now(),
): ProviderForecast {
  const windows = [15, 60, 24 * 60, 7 * 24 * 60].map((m) =>
    burnRate(snapshot.provider, m, events, nowMs),
  );
  // Use the 1-hour window as the short-term depletion signal.
  const hourly = windows[1].hourlyBurnUsd;
  const estimatedHoursRemaining = estimateHoursRemaining(snapshot, hourly);
  return {
    provider: snapshot.provider,
    windows,
    estimatedHoursRemaining,
    spike: detectSpike(snapshot.provider, 3, events, nowMs),
    fastBurnWarning: estimatedHoursRemaining != null && estimatedHoursRemaining <= 24,
    fastBurnCritical: estimatedHoursRemaining != null && estimatedHoursRemaining <= 6,
  };
}
