import { NextResponse } from "next/server";

import { featureBudgets } from "@/lib/store";
import type { FeatureState } from "@/lib/types";

const VALID_STATES: FeatureState[] = ["enabled", "degraded", "paused", "disabled"];

// POST /admin/ai/features/{featureName}/state  (PRD §20.4)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ featureName: string }> },
) {
  const { featureName } = await params;
  const feature = featureBudgets.find((f) => f.featureName === featureName);

  if (!feature) {
    return NextResponse.json(
      { error: `Unknown AI feature: ${featureName}` },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    state?: string;
    reason?: string;
  };

  if (!body.state || !VALID_STATES.includes(body.state as FeatureState)) {
    return NextResponse.json(
      { error: `state must be one of: ${VALID_STATES.join(", ")}` },
      { status: 400 },
    );
  }

  const previousState = feature.state;
  feature.state = body.state as FeatureState;
  feature.updatedAt = new Date().toISOString();

  // In production this would also write an ai_runtime_state_events row (PRD §19.5).
  return NextResponse.json({
    featureName,
    previousState,
    newState: feature.state,
    reason: body.reason ?? "manual override",
    actor: "admin",
    updatedAt: feature.updatedAt,
  });
}
