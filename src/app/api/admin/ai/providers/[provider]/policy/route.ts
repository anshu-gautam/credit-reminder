import { NextResponse } from "next/server";

import { providerRegistry } from "@/lib/store";
import type { ProviderName } from "@/lib/types";

// POST /admin/ai/providers/{provider}/policy  (PRD §20.5)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const entry = providerRegistry.find((p) => p.name === (provider as ProviderName));

  if (!entry) {
    return NextResponse.json(
      { error: `Unknown provider: ${provider}` },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
    warningThresholdUsd?: number;
    criticalThresholdUsd?: number;
    emergencyThresholdUsd?: number;
    warnPercent?: number;
    criticalPercent?: number;
    emergencyPercent?: number;
    pollIntervalMinutes?: number;
  };

  if (typeof body.enabled === "boolean") entry.enabled = body.enabled;
  if (body.warningThresholdUsd != null) entry.warningThresholdUsd = body.warningThresholdUsd;
  if (body.criticalThresholdUsd != null) entry.criticalThresholdUsd = body.criticalThresholdUsd;
  if (body.emergencyThresholdUsd != null) entry.emergencyThresholdUsd = body.emergencyThresholdUsd;
  if (body.warnPercent != null) entry.warnPercent = body.warnPercent;
  if (body.criticalPercent != null) entry.criticalPercent = body.criticalPercent;
  if (body.emergencyPercent != null) entry.emergencyPercent = body.emergencyPercent;
  if (body.pollIntervalMinutes != null) entry.pollIntervalMinutes = body.pollIntervalMinutes;

  return NextResponse.json({ provider: entry.name, policy: entry });
}
