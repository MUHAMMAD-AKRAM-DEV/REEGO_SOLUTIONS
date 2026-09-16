import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";

import { db } from "@/lib/db";

export const SESSION_COOKIE = "mc_session";

/** Idle-free absolute lifetime. Short by general web standards, deliberately. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const BCRYPT_COST = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// ---------------------------------------------------------------------------
// Session tokens
// ---------------------------------------------------------------------------

/**
 * The raw token lives only in the user's cookie; the database stores its
 * SHA-256. A leaked database therefore yields no usable sessions.
 *
 * SHA-256 without a salt is correct here: the token is 256 bits of CSPRNG
 * output, so there is no dictionary to attack and no reason to pay a slow KDF
 * on every request.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function issueToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  context: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = issueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Resolve the current user from the session cookie, or null.
 *
 * Returns null rather than throwing so callers decide what an anonymous
 * request means for them — a page redirects, an API route returns 401.
 */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.user.isActive) return null;

  return session.user;
}

export async function revokeSession(token: string): Promise<void> {
  await db.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Used when deactivating an account or changing a password. */
export async function revokeAllSessionsFor(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "locked" | "inactive" };

/**
 * Verify credentials and apply lockout.
 *
 * On an unknown address this still runs a bcrypt comparison against a dummy
 * hash, so response time does not reveal whether the address exists.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<LoginResult> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }

  if (!user.isActive) return { ok: false, reason: "inactive" };

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil:
          failedLoginCount >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCKOUT_MS)
            : null,
      },
    });
    return { ok: false, reason: "invalid" };
  }

  const fresh = await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return { ok: true, user: fresh };
}

/**
 * A valid bcrypt hash, cost 12, of 32 random bytes that were never recorded.
 * Comparing against it costs the same as a real check, so an unknown address
 * and a wrong password take the same time to reject.
 */
const DUMMY_HASH =
  "$2b$12$liSkUv5Rbm6rlvzRi5M4ye4NCc1WJZvuctJLX57zS993s9doZZ7cy";

/** Constant-time compare for non-secret-derived tokens such as CSRF values. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
