import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage behind a small interface.
 *
 * Today it writes to a directory outside the web root; in production this
 * becomes S3 with server-side encryption and short-lived signed URLs. Callers
 * only ever hold an opaque `storageKey`, so swapping the driver touches this
 * file and nothing else.
 *
 * Nothing here is ever served statically — every download goes through a
 * route handler that checks the session first.
 */

const ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

/** Extensions the agency actually exchanges. Anything else is refused. */
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isAllowedMime(mimeType: string): boolean {
  return ALLOWED_MIME.has(mimeType);
}

/**
 * Keys are generated, never derived from the uploaded filename — a filename
 * from a browser is untrusted input and must never influence a path.
 */
function generateKey(): string {
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${folder}/${randomBytes(16).toString("hex")}`;
}

function resolveKey(storageKey: string): string {
  const resolved = path.resolve(ROOT, storageKey);
  // Defence in depth: a key that escapes the root must never be read or
  // written, whatever put it in the database.
  if (!resolved.startsWith(path.resolve(ROOT))) {
    throw new Error("Refusing to access a path outside the upload root.");
  }
  return resolved;
}

export async function putFile(bytes: Buffer): Promise<string> {
  const storageKey = generateKey();
  const target = resolveKey(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return storageKey;
}

export function readFileStream(storageKey: string) {
  return createReadStream(resolveKey(storageKey));
}

export async function deleteFile(storageKey: string): Promise<void> {
  try {
    await unlink(resolveKey(storageKey));
  } catch (error) {
    // A missing file should not block removing its database row.
    console.error("[storage] could not delete file", { storageKey, error });
  }
}
