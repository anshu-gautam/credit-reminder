import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { allAdapters, pollProviders } from "@/lib/providers";
import { providerRegistry } from "@/lib/store";
import { startOfMonth } from "@/lib/providers/http";
import type { ProviderUsageQuery } from "@/lib/types";

// POST /admin/ai/poll  — manually trigger a provider poll (PRD §36).
// Returns refreshed snapshots, per-provider liveness, and polling-failure counts.
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const snapshots = await pollProviders();

  const window: ProviderUsageQuery = {
    startTime: startOfMonth().toISOString(),
    endTime: new Date().toISOString(),
    groupBy: ["model", "feature"],
  };

  const adapters = await Promise.all(
    allAdapters().map(async (a) => {
      const reg = providerRegistry.find((r) => r.name === a.name)!;
      let usageRows = 0;
      try {
        usageRows = (await a.fetchUsageBreakdown(window)).length;
      } catch {
        usageRows = -1;
      }
      return {
        provider: a.name,
        live: a.isLive(),
        lastPolledAt: reg.lastPolledAt,
        consecutivePollingFailures: reg.consecutivePollingFailures,
        usageRows,
      };
    }),
  );

  return NextResponse.json({ polledAt: new Date().toISOString(), adapters, snapshots });
}
