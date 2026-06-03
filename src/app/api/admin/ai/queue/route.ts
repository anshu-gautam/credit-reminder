import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { drainProvider, listQueue, pendingCount } from "@/lib/queue";

// GET /admin/ai/queue — list queued/processed jobs (PRD FR-7).
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ pending: pendingCount(), jobs: listQueue() });
}

// POST /admin/ai/queue/drain — manually drain a provider's queued jobs.
// Body: { provider: string }
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  if (!body.provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }
  const drained = drainProvider(body.provider);
  return NextResponse.json({ provider: body.provider, drained, pending: pendingCount() });
}
