import { NextResponse } from "next/server";

import { groupUsage } from "@/lib/aggregate";
import { usageEvents } from "@/lib/store";

type GroupKey = "provider" | "feature" | "model" | "status";
const VALID: GroupKey[] = ["provider", "feature", "model", "status"];

// GET /admin/ai/usage?start=...&end=...&groupBy=provider,feature,model  (PRD §20.3)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const groupByParam = searchParams.get("groupBy") ?? "provider,feature,model";

  const startMs = start ? new Date(start).getTime() : 0;
  const endMs = end ? new Date(end).getTime() : Date.now();

  const events = usageEvents.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= startMs && t <= endMs;
  });

  const groups = groupByParam
    .split(",")
    .map((g) => g.trim())
    .filter((g): g is GroupKey => VALID.includes(g as GroupKey));

  const breakdown: Record<string, unknown> = {};
  for (const g of groups) {
    breakdown[g] = groupUsage(g, events);
  }

  return NextResponse.json({
    window: { start: start ?? null, end: end ?? new Date(endMs).toISOString() },
    eventCount: events.length,
    breakdown,
  });
}
