import { redirect } from "next/navigation";
import type { User } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth";

/**
 * Every page under the app shell calls this. Returns the signed-in user or
 * sends the request to the login screen — pages never render a half state.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const ROLE_LABELS: Record<User["role"], string> = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  TEAM_LEAD: "Team lead",
  CREDENTIALING_SPECIALIST: "Credentialing",
  BILLER: "Biller",
  AR_CALLER: "AR follow-up",
  QA_AUDITOR: "Quality audit",
  CLIENT_USER: "Client portal",
};

export function roleLabel(role: User["role"]): string {
  return ROLE_LABELS[role];
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
