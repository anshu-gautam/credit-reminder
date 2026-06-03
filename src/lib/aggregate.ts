import { usageEvents } from "./store";
import type { UsageEvent } from "./types";

type GroupKey = "provider" | "feature" | "model" | "status";

function keyOf(e: UsageEvent, k: GroupKey): string {
  switch (k) {
    case "provider":
      return e.provider;
    case "feature":
      return e.featureName;
    case "model":
      return e.model;
    case "status":
      return e.status;
  }
}

export interface GroupedUsage {
  name: string;
  cost: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
}

export function groupUsage(
  groupBy: GroupKey,
  events: UsageEvent[] = usageEvents,
): GroupedUsage[] {
  const map = new Map<string, GroupedUsage>();
  for (const e of events) {
    const name = keyOf(e, groupBy);
    const row = map.get(name) ?? {
      name,
      cost: 0,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      errors: 0,
    };
    row.cost += e.estimatedCostUsd ?? 0;
    row.requests += e.requestCount;
    row.inputTokens += e.inputTokens ?? 0;
    row.outputTokens += e.outputTokens ?? 0;
    if (e.status === "error") row.errors += 1;
    map.set(name, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, cost: Number(r.cost.toFixed(2)) }))
    .sort((a, b) => b.cost - a.cost);
}

export function totals(events: UsageEvent[] = usageEvents) {
  return events.reduce(
    (acc, e) => {
      acc.cost += e.estimatedCostUsd ?? 0;
      acc.requests += e.requestCount;
      if (e.status === "error") acc.errors += 1;
      return acc;
    },
    { cost: 0, requests: 0, errors: 0 },
  );
}
