import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { loadState } from "@/lib/persistence";

// GET /admin/ai/alerts — dispatched alert history (PRD FR-5, §19.4).
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { alertHistory } = loadState();
  return NextResponse.json({ count: alertHistory.length, alerts: alertHistory });
}
