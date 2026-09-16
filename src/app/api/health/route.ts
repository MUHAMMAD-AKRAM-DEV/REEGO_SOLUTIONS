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
  } catch (error) {
    // The response stays deliberately silent, but swallowing the reason
    // entirely left a failing deployment with nothing to diagnose from. The
    // detail goes to the server log, where only an operator can read it.
    console.error("[health] database unreachable", {
      code:
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "unknown",
      message: error instanceof Error ? error.message : String(error),
      // Whether the variable is set at all, without ever printing its value.
      databaseUrlPresent: Boolean(process.env.DATABASE_URL),
    });

    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
