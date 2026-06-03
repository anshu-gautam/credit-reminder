// Provider adapter registry + poller (PRD §15 FR-4, §36).
// This module depends on the store; the store does not depend on it, so there
// is no import cycle.

import type {
  ProviderAdapter,
  ProviderBudgetSnapshot,
  ProviderName,
} from "@/lib/types";
import { computeProviderState } from "@/lib/policy";
import {
  getSnapshots,
  providerRegistry,
  setSnapshots,
  thresholdsFor,
} from "@/lib/store";
import { openRouterAdapter } from "./openrouter";
import { openAiAdapter } from "./openai";
import { anthropicAdapter } from "./anthropic";

const adapters: Record<ProviderName, ProviderAdapter> = {
  openrouter: openRouterAdapter,
  openai: openAiAdapter,
  anthropic: anthropicAdapter,
};

export function getAdapter(name: ProviderName): ProviderAdapter {
  return adapters[name];
}

export function allAdapters(): ProviderAdapter[] {
  return Object.values(adapters);
}

// Timestamp (ms) of the last fetch *attempt* per provider. Separate from the
// registry's displayed lastPolledAt so the seeded display value does not
// suppress the very first live fetch.
const lastAttemptMs: Partial<Record<ProviderName, number>> = {};

// Polls enabled providers, derives health state from current thresholds, updates
// the snapshot cache, and tracks consecutive polling failures (FR-4).
//
// Each provider is only re-fetched once its pollIntervalMinutes has elapsed;
// within the interval the cached snapshot is reused. This respects the per-
// provider poll cadence and prevents hammering provider APIs on every request.
// Pass { force: true } to bypass the interval (e.g. a manual poll).
export async function pollProviders(
  opts: { force?: boolean } = {},
): Promise<ProviderBudgetSnapshot[]> {
  const force = opts.force ?? false;
  const lastKnown = getSnapshots();
  const now = Date.now();

  const results = await Promise.all(
    providerRegistry.map(async (reg): Promise<ProviderBudgetSnapshot> => {
      const adapter = getAdapter(reg.name);
      const previous = lastKnown.find((s) => s.provider === reg.name);
      const attemptedAt = lastAttemptMs[reg.name] ?? 0;
      const intervalMs = reg.pollIntervalMinutes * 60_000;

      // Not due yet — reuse the cached snapshot.
      if (!force && previous && now - attemptedAt < intervalMs) {
        return previous;
      }

      lastAttemptMs[reg.name] = now;
      try {
        const data = await adapter.fetchBudgetSnapshot();
        const state = computeProviderState(
          data as ProviderBudgetSnapshot,
          thresholdsFor(reg.name),
        );
        reg.lastPolledAt = new Date().toISOString();
        reg.consecutivePollingFailures = 0;
        return { ...data, state };
      } catch (error) {
        // Keep the last known snapshot but mark health unknown (FR-3: polling
        // failures must not crash the app).
        reg.consecutivePollingFailures += 1;
        const normalized = adapter.classifyError(error);
        const base: ProviderBudgetSnapshot =
          previous ?? {
            provider: reg.name,
            state: "unknown",
            lastCheckedAt: new Date().toISOString(),
          };
        return {
          ...base,
          state: normalized === "AUTH_FAILED" ? "auth_error" : "unknown",
          lastCheckedAt: new Date().toISOString(),
        };
      }
    }),
  );

  setSnapshots(results);
  return results;
}

// True when at least one provider has a live credential configured.
export function anyProviderLive(): boolean {
  return allAdapters().some((a) => a.isLive());
}
