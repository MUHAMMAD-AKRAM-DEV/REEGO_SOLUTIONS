import { headers } from "next/headers";
import type { AuditAction, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type AuditInput = {
  actorId?: string | null;
  action: AuditAction;
  /** Model name, e.g. "Provider". Loose string so the log outlives renames. */
  entityType: string;
  entityId?: string | null;
  /** Denormalised so "everything done to this client" stays one index scan. */
  clientId?: string | null;
  /** Written for whoever reads this during an audit, not for a developer. */
  summary: string;
  /** Changed fields and request context. Never put raw PHI in here. */
  metadata?: Prisma.InputJsonValue;
};

/**
 * Append one row to the audit log.
 *
 * Deliberately swallows its own failures: an audit write that throws must not
 * take down the request that triggered it. Failures are logged to stderr so
 * they surface in monitoring rather than vanishing.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const requestHeaders = await headers();

    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        clientId: input.clientId ?? null,
        summary: input.summary,
        metadata: input.metadata,
        ipAddress: clientIpFrom(requestHeaders),
        userAgent: requestHeaders.get("user-agent"),
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit entry", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
}

/**
 * Behind a load balancer the socket address is the balancer, so prefer the
 * forwarded chain. Only trust this when a proxy you control sets it.
 */
function clientIpFrom(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return requestHeaders.get("x-real-ip");
}
