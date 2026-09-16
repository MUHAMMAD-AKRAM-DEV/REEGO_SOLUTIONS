import { NextResponse } from "next/server";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Readable } from "node:stream";

import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReachClient } from "@/lib/rbac";
import { readFileStream } from "@/lib/storage";

/**
 * Documents are never served statically. Every download passes through here so
 * the session is checked, the client scope is enforced, and the read lands in
 * the audit log before a single byte goes out.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const document = await db.document.findUnique({
    where: { id },
    include: { provider: { select: { clientId: true } } },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const owningClientId = document.clientId ?? document.provider?.clientId ?? null;
  if (owningClientId && !canReachClient(user, owningClientId)) {
    // Deliberately 404 rather than 403 — a portal user should not learn that
    // another practice's document exists.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await recordAudit({
    actorId: user.id,
    action: "READ",
    entityType: "Document",
    entityId: document.id,
    clientId: owningClientId,
    summary: `${user.fullName} downloaded ${document.title}`,
    metadata: { fileName: document.fileName },
  });

  const stream = Readable.toWeb(
    readFileStream(document.storageKey),
  ) as NodeReadableStream;

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.sizeBytes),
      // `attachment` keeps a malicious upload from rendering in our own origin.
      "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
