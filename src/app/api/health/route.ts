import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * Liveness and readiness probe for the load balancer.
 *
 * Deliberately returns nothing about the application beyond whether it can
 * reach its database — an unauthenticated endpoint should not describe the
 * system to whoever asks.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
