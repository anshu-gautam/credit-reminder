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

// Polls every enabled provider, derives health state from current thresholds,
// updates the snapshot cache, and tracks consecutive polling failures so a
// provider_polling_failed alert can fire after repeated failures (FR-4).
export async function pollProviders(): Promise<ProviderBudgetSnapshot[]> {
  const lastKnown = getSnapshots();
  const results = await Promise.all(
    providerRegistry.map(async (reg): Promise<ProviderBudgetSnapshot> => {
      const adapter = getAdapter(reg.name);
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
        const previous = lastKnown.find((s) => s.provider === reg.name);
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
