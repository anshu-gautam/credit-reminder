import { NextResponse } from "next/server";

import { classifyError, evaluateDecision, isRetryable } from "@/lib/policy";
import { featureBudgets, snapshots } from "@/lib/store";

// POST /api/ai/gateway  — simplified internal AI Gateway (PRD §13, §35).
//
// Every product feature is expected to route AI calls through this endpoint so
// the request can be budget-checked and provider health enforced before
// execution. This is a runnable, dependency-free version of the decision flow
// in FR-7: it does not call a real model, but it returns the exact control
// decision (allow / queue / pause / fallback / block) the gateway would take.
//
// Body: { feature: string, customerId?: string, simulateError?: { status?: number, code?: string } }
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    feature?: string;
    customerId?: string;
    simulateError?: { status?: number; code?: string; message?: string };
  };

  if (!body.feature) {
    return NextResponse.json({ error: "feature is required" }, { status: 400 });
  }

  // 1–2. Validate feature config.
  const feature = featureBudgets.find((f) => f.featureName === body.feature);
  if (!feature) {
    return NextResponse.json(
      { error: `Unknown AI feature: ${body.feature}` },
      { status: 404 },
    );
  }

  // 3–6. Evaluate budget + provider health and select the runtime action.
  const snapshot = snapshots.find((s) => s.provider === feature.preferredProvider)!;
  const decision = evaluateDecision(feature, snapshot);

  const trace = {
    feature: feature.featureName,
    priority: feature.priority,
    provider: feature.preferredProvider,
    providerState: snapshot.state,
    monthlyBudgetUsd: feature.monthlyBudgetUsd,
    currentMonthlyUsageUsd: feature.currentMonthlyUsageUsd,
    decision,
  };

  // Controlled, non-executing outcomes (PRD §22 user-facing copy).
  if (decision === "block_with_graceful_message" || decision === "pause") {
    return NextResponse.json({
      ...trace,
      status: "unavailable",
      message: "AI is temporarily unavailable. Please try again shortly.",
    });
  }
  if (decision === "queue") {
    return NextResponse.json({
      ...trace,
      status: "queued",
      message:
        "Your request has been queued and will be processed once AI capacity is restored.",
    });
  }

  // 7. "Execute" the request. simulateError lets callers exercise the runtime
  // error-normalization path (FR-8) without a live provider.
  if (body.simulateError) {
    const normalizedError = classifyError(feature.preferredProvider, body.simulateError);
    const retryable = isRetryable(normalizedError);
    return NextResponse.json({
      ...trace,
      status: "error",
      normalizedError,
      retried: retryable,
      fellBackTo: !retryable && feature.fallbackProviders[0] ? feature.fallbackProviders[0] : null,
      message: retryable
        ? "Transient provider error — bounded backoff applied."
        : "Provider billing/credit error — not retried; alert raised.",
    });
  }

  const model =
    decision === "allow_with_cheaper_model" ? "cheaper-fallback-model" : "preferred-model";

  // 8. Log usage (omitted here) and return success.
  return NextResponse.json({
    ...trace,
    status: "success",
    model,
    message: "Request allowed by gateway policy.",
  });
}
