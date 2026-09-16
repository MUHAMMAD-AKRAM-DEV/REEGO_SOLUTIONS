"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import {
  authenticate,
  clearSessionCookie,
  createSession,
  getCurrentUser,
  revokeSession,
  setSessionCookie,
  SESSION_COOKIE,
} from "@/lib/auth";
import { cookies } from "next/headers";

const Credentials = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginState = { error?: string };

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message };
  }

  const { email, password } = parsed.data;

  let result: Awaited<ReturnType<typeof authenticate>>;
  try {
    result = await authenticate(email, password);
  } catch (error) {
    // A database that is unreachable or misconfigured is an operational
    // problem, not a failed sign-in. Say so plainly instead of letting a
    // Prisma stack trace surface as a broken page.
    console.error("[login] database unavailable", error);
    return { error: databaseErrorMessage(error) };
  }

  if (!result.ok) {
    await recordAudit({
      action: "LOGIN_FAILED",
      entityType: "User",
      summary: `Failed sign-in for ${email} (${result.reason})`,
    });

    // Never distinguish "no such account" from "wrong password" — that tells an
    // attacker which addresses are worth attacking.
    if (result.reason === "locked") {
      return {
        error:
          "Too many attempts. This account is locked for 15 minutes. Contact an administrator if you need access sooner.",
      };
    }
    if (result.reason === "inactive") {
      return {
        error: "This account has been deactivated. Contact an administrator.",
      };
    }
    return { error: "That email and password do not match." };
  }

  const requestHeaders = await headers();
  const { token, expiresAt } = await createSession(result.user.id, {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  });
  await setSessionCookie(token, expiresAt);

  await recordAudit({
    actorId: result.user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: result.user.id,
    summary: `${result.user.fullName} signed in`,
  });

  redirect("/overview");
}

/**
 * Turn a Prisma connection failure into something a person can act on. Setup
 * problems are common on a fresh checkout, so the message names the fix.
 */
function databaseErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "P1000":
      return "The database rejected our credentials. Run `npm run db:init` to create the application role, then `npm run db:migrate`.";
    case "P1001":
    case "P1002":
      return "Cannot reach the database. Check that PostgreSQL is running and that DATABASE_URL in .env.local is correct.";
    case "P1003":
      return "The database exists but has no tables. Run `npm run db:migrate` followed by `npm run db:seed`.";
    case "P2021":
      return "The database is missing tables. Run `npm run db:migrate` followed by `npm run db:seed`.";
    default:
      return "Sign-in is unavailable because the database could not be reached. Check the server logs for details.";
  }
}

export async function signOut() {
  const user = await getCurrentUser();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) await revokeSession(token);
  await clearSessionCookie();

  if (user) {
    await recordAudit({
      actorId: user.id,
      action: "LOGOUT",
      entityType: "User",
      entityId: user.id,
      summary: `${user.fullName} signed out`,
    });
  }

  redirect("/login");
}
