// Alert engine: turns provider/feature state into deduplicated, escalated,
// and recovery-aware alerts and dispatches them (PRD FR-5, FR-11, §16, §21).

import type {
  AlertEvent,
  AlertSeverity,
  FeatureBudget,
  ProviderBudgetSnapshot,
  ProviderRegistryEntry,
} from "../types";
import { loadState, saveState } from "../persistence";
import { channelsForSeverity, deliver } from "./channels";

// Re-send windows per severity (PRD §11). Emergencies always send.
const DEDUPE_WINDOW_MS: Record<AlertSeverity, number> = {
  info: 6 * 60 * 60 * 1000,
  warning: 6 * 60 * 60 * 1000,
  critical: 45 * 60 * 1000,
  emergency: 0,
  recovery: 60 * 60 * 1000,
};

// Pure dedupe check — exported for tests.
export function shouldSend(
  dedupeKey: string,
  severity: AlertSeverity,
  nowMs: number,
  dedupe: Record<string, string>,
): boolean {
  if (severity === "emergency") return true;
  const last = dedupe[dedupeKey];
  if (!last) return true;
  return nowMs - new Date(last).getTime() >= DEDUPE_WINDOW_MS[severity];
}

function genId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const RECOMMENDED: Partial<Record<string, string>> = {
  provider_budget_warning: "Review current usage and verify whether spend is expected.",
  provider_balance_low: "Top up provider credits or raise the auto top-up threshold.",
  provider_budget_critical: "Pause low-priority jobs or route eligible traffic to another provider.",
  provider_budget_exhausted: "Increase the approved budget or keep the provider disabled until next cycle.",
  provider_rate_limited: "Reduce concurrency, respect retry-after, and enable fallback for eligible requests.",
  provider_auth_failed: "Rotate or re-issue the provider admin key; the affected provider has been disabled.",
  provider_polling_failed: "Check provider API status and the configured admin credential.",
  feature_budget_exceeded: "The feature was paused/queued per policy. Raise its budget to resume.",
};

// Maps a non-healthy provider snapshot to an alert (or null if healthy).
export function buildProviderAlert(
  snapshot: ProviderBudgetSnapshot,
  reg?: ProviderRegistryEntry,
): AlertEvent | null {
  const prepaid = snapshot.remainingCreditsUsd !== undefined;
  let severity: AlertSeverity;
  let alertType: AlertEvent["alertType"];
  let current: number | null = null;
  let threshold: number | null = null;

  switch (snapshot.state) {
    case "warning":
      severity = "warning";
      alertType = prepaid ? "provider_balance_low" : "provider_budget_warning";
      break;
    case "critical":
      severity = "critical";
      alertType = "provider_budget_critical";
      break;
    case "emergency":
      severity = "emergency";
      alertType = "provider_budget_exhausted";
      break;
    case "rate_limited":
      severity = "warning";
      alertType = "provider_rate_limited";
      break;
    case "auth_error":
      severity = "critical";
      alertType = "provider_auth_failed";
      break;
    default:
      return null;
  }

  if (prepaid) {
    current = snapshot.remainingCreditsUsd ?? null;
    threshold =
      snapshot.state === "warning"
        ? reg?.warningThresholdUsd ?? null
        : snapshot.state === "critical"
          ? reg?.criticalThresholdUsd ?? null
          : reg?.emergencyThresholdUsd ?? null;
  } else {
    current = snapshot.monthToDateSpendUsd ?? null;
    const pct =
      snapshot.state === "warning"
        ? reg?.warnPercent ?? 70
        : snapshot.state === "critical"
          ? reg?.criticalPercent ?? 90
          : reg?.emergencyPercent ?? 100;
    threshold = snapshot.monthlyBudgetUsd ? Number(((snapshot.monthlyBudgetUsd * pct) / 100).toFixed(2)) : null;
  }

  return {
    id: genId(),
    severity,
    alertType,
    provider: snapshot.provider,
    featureName: snapshot.topFeature ?? null,
    model: snapshot.topModel ?? null,
    message: messageFor(snapshot, alertType),
    currentValueUsd: current,
    thresholdValueUsd: threshold,
    dedupeKey: `provider:${snapshot.provider}:${alertType}`,
    sentTo: [],
    sentAt: new Date().toISOString(),
    resolvedAt: null,
    recommendedAction: RECOMMENDED[alertType],
  };
}

function messageFor(snapshot: ProviderBudgetSnapshot, type: string): string {
  const name = snapshot.provider[0].toUpperCase() + snapshot.provider.slice(1);
  if (type === "provider_balance_low" || type === "provider_budget_exhausted") {
    return `${name} remaining credits are ${fmt(snapshot.remainingCreditsUsd)}.`;
  }
  if (snapshot.monthToDateSpendUsd != null && snapshot.monthlyBudgetUsd) {
    const pct = Math.round((snapshot.monthToDateSpendUsd / snapshot.monthlyBudgetUsd) * 100);
    return `${name} month-to-date spend has reached ${pct}% of the monthly budget.`;
  }
  if (type === "provider_auth_failed") return `${name} returned an authentication error.`;
  if (type === "provider_rate_limited") return `${name} is returning sustained rate-limit responses.`;
  return `${name} provider state is ${snapshot.state}.`;
}

function fmt(v?: number): string {
  return v == null ? "unknown" : `$${v.toFixed(2)}`;
}

function buildRecovery(snapshot: ProviderBudgetSnapshot): AlertEvent {
  const name = snapshot.provider[0].toUpperCase() + snapshot.provider.slice(1);
  return {
    id: genId(),
    severity: "recovery",
    alertType: "recovery",
    provider: snapshot.provider,
    featureName: null,
    model: null,
    message: `${name} has returned to a healthy state.`,
    currentValueUsd: snapshot.remainingCreditsUsd ?? snapshot.remainingMonthlyBudgetUsd ?? null,
    thresholdValueUsd: null,
    dedupeKey: `provider:${snapshot.provider}:recovery`,
    sentTo: [],
    sentAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    recommendedAction: "Paused features will be restored gradually; queued jobs will drain.",
  };
}

// Evaluates all providers/features, dispatches due alerts, emits recovery alerts,
// drains queued jobs on recovery, and persists alert history + dedupe state.
export async function evaluateAndDispatch(
  snapshots: ProviderBudgetSnapshot[],
  features: FeatureBudget[],
  registry: ProviderRegistryEntry[],
): Promise<AlertEvent[]> {
  if (process.env.AI_BUDGET_MONITOR_ENABLED === "false") return [];

  const now = Date.now();
  const state = loadState();
  const dispatched: AlertEvent[] = [];

  const send = async (alert: AlertEvent, activeKey?: string) => {
    alert.sentTo = await deliver(alert, channelsForSeverity(alert.severity));
    state.dedupe[alert.dedupeKey] = new Date(now).toISOString();
    if (activeKey) state.activeAlerts[activeKey] = alert.id;
    state.alertHistory.unshift(alert);
    dispatched.push(alert);
  };

  for (const snap of snapshots) {
    const baseKey = `provider:${snap.provider}`;
    const reg = registry.find((r) => r.name === snap.provider);

    if (snap.state === "healthy") {
      if (state.activeAlerts[baseKey]) {
        const recovery = buildRecovery(snap);
        await send(recovery);
        delete state.activeAlerts[baseKey];
        // Clear provider dedupe so a future regression re-fires immediately.
        for (const key of Object.keys(state.dedupe)) {
          if (key.startsWith(`${baseKey}:`) && !key.endsWith(":recovery")) delete state.dedupe[key];
        }
        // Drain queued jobs for this provider (gradual resume).
        for (const job of state.queue) {
          if (job.provider === snap.provider && job.status === "queued") {
            job.status = "processed";
            job.processedAt = new Date().toISOString();
          }
        }
      }
      continue;
    }

    const alert = buildProviderAlert(snap, reg);
    if (alert && shouldSend(alert.dedupeKey, alert.severity, now, state.dedupe)) {
      await send(alert, baseKey);
    }
  }

  // Polling failures (PRD §11: alert after 3 consecutive failures).
  for (const reg of registry) {
    if (reg.consecutivePollingFailures >= 3) {
      const dedupeKey = `provider:${reg.name}:provider_polling_failed`;
      if (shouldSend(dedupeKey, "critical", now, state.dedupe)) {
        await send(
          {
            id: genId(),
            severity: "critical",
            alertType: "provider_polling_failed",
            provider: reg.name,
            featureName: null,
            model: null,
            message: `Failed to poll ${reg.name} budget data ${reg.consecutivePollingFailures} times in a row.`,
            currentValueUsd: null,
            thresholdValueUsd: null,
            dedupeKey,
            sentTo: [],
            sentAt: new Date().toISOString(),
            resolvedAt: null,
            recommendedAction: RECOMMENDED.provider_polling_failed,
          },
          `provider:${reg.name}`,
        );
      }
    }
  }

  // Feature hard-budget breaches (PRD FR-6 / TC6).
  for (const f of features) {
    if (f.currentMonthlyUsageUsd >= f.monthlyBudgetUsd) {
      const dedupeKey = `feature:${f.featureName}:feature_budget_exceeded`;
      if (shouldSend(dedupeKey, "critical", now, state.dedupe)) {
        await send({
          id: genId(),
          severity: "critical",
          alertType: "feature_budget_exceeded",
          provider: f.currentProvider,
          featureName: f.featureName,
          model: null,
          message: `${f.featureName} reached its ${fmt(f.monthlyBudgetUsd)} monthly hard budget.`,
          currentValueUsd: f.currentMonthlyUsageUsd,
          thresholdValueUsd: f.monthlyBudgetUsd,
          dedupeKey,
          sentTo: [],
          sentAt: new Date().toISOString(),
          resolvedAt: null,
          recommendedAction: RECOMMENDED.feature_budget_exceeded,
        });
      }
    }
  }

  // Keep history bounded.
  if (state.alertHistory.length > 200) state.alertHistory.length = 200;
  saveState(state);
  return dispatched;
}
