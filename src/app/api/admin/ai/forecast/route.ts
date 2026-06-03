import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { pollProviders } from "@/lib/providers";
import { forecastProvider } from "@/lib/forecast";

// GET /admin/ai/forecast — burn rate and time-to-exhaustion per provider (FR-12).
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const snapshots = await pollProviders();
  const forecasts = snapshots.map((s) => forecastProvider(s));
  return NextResponse.json({ generatedAt: new Date().toISOString(), forecasts });
}
