import { NextResponse } from "next/server";

// Minimal admin authentication guard for the internal admin APIs (PRD §23).
// When ADMIN_API_TOKEN is set, every /admin/* request must send a matching
// `Authorization: Bearer <token>` header. When it is not set (local/dev), the
// routes stay open so the dashboard is explorable without setup.
export function requireAdmin(request: Request): NextResponse | null {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return null;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token || token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid admin bearer token." },
      { status: 401 },
    );
  }
  return null;
}
