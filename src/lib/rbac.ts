import { UserRole, type User } from "@prisma/client";

/**
 * Capabilities, not roles, are what call sites check. Roles map onto
 * capabilities here so that adding a role later is one edit in one file.
 */
export type Capability =
  | "client.view"
  | "client.manage"
  | "provider.view"
  | "provider.manage"
  | "payer.manage"
  | "user.manage"
  | "audit.view"
  | "work.assign"
  | "credentialing.manage"
  | "qa.audit"
  | "data.export";

const ALL_STAFF_READ: Capability[] = ["client.view", "provider.view"];

const CAPABILITIES: Record<UserRole, Capability[]> = {
  [UserRole.ADMIN]: [
    "client.view",
    "client.manage",
    "provider.view",
    "provider.manage",
    "payer.manage",
    "user.manage",
    "audit.view",
    "work.assign",
    "credentialing.manage",
    "qa.audit",
    "data.export",
  ],
  [UserRole.MANAGER]: [
    ...ALL_STAFF_READ,
    "client.manage",
    "provider.manage",
    "payer.manage",
    "audit.view",
    "work.assign",
    "credentialing.manage",
    "qa.audit",
    "data.export",
  ],
  [UserRole.TEAM_LEAD]: [...ALL_STAFF_READ, "provider.manage", "work.assign", "qa.audit"],
  [UserRole.CREDENTIALING_SPECIALIST]: [
    ...ALL_STAFF_READ,
    "provider.manage",
    "credentialing.manage",
  ],
  [UserRole.BILLER]: ALL_STAFF_READ,
  [UserRole.AR_CALLER]: ALL_STAFF_READ,
  [UserRole.QA_AUDITOR]: [...ALL_STAFF_READ, "qa.audit", "audit.view"],
  // External accounts. Scope to their own client is enforced separately by
  // canReachClient — capability alone is never enough for a portal user.
  [UserRole.CLIENT_USER]: ["client.view", "provider.view"],
};

export function can(user: Pick<User, "role">, capability: Capability): boolean {
  return CAPABILITIES[user.role].includes(capability);
}

/**
 * Client-portal users may only ever reach their own client's rows. Agency
 * staff reach every client, which is what their role is for.
 *
 * Every query touching client-scoped data must pass through this — a
 * capability check on its own does not stop one portal user reading another
 * practice's providers.
 */
export function canReachClient(
  user: Pick<User, "role" | "clientId">,
  clientId: string,
): boolean {
  if (user.role === UserRole.CLIENT_USER) return user.clientId === clientId;
  return true;
}

/** Throwing variant for server actions and route handlers. */
export function assertCan(
  user: Pick<User, "role">,
  capability: Capability,
): void {
  if (!can(user, capability)) {
    throw new Error(`Forbidden: ${user.role} lacks ${capability}`);
  }
}
