"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/components/form";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { MAX_UPLOAD_BYTES, isAllowedMime, putFile } from "@/lib/storage";

export async function uploadDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "client.manage") && !can(user, "credentialing.manage")) {
    return { error: "You do not have permission to upload documents." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload.", fields: { file: "Required." } };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`,
      fields: { file: "Too large." },
    };
  }

  if (!isAllowedMime(file.type)) {
    return {
      error: `Files of type ${file.type || "unknown"} are not accepted. Use PDF, an image, or an Office document.`,
      fields: { file: "Unsupported file type." },
    };
  }

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "OTHER");
  const clientId = String(formData.get("clientId") ?? "") || null;
  const providerId = String(formData.get("providerId") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const replacesId = String(formData.get("replacesId") ?? "") || null;

  if (!title) {
    return { error: "Give the document a title.", fields: { title: "Required." } };
  }
  if (!clientId && !providerId) {
    return {
      error: "Attach the document to a client or a provider.",
      fields: { clientId: "Choose one." },
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = await putFile(bytes);

  // Replacing an existing document starts a new version rather than
  // overwriting — the previous file stays readable.
  const previousVersion = replacesId
    ? await db.document.findUnique({ where: { id: replacesId } })
    : null;

  const document = await db.document.create({
    data: {
      title,
      category: category as never,
      clientId,
      providerId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey,
      notes,
      replacesId: previousVersion ? previousVersion.id : null,
      version: previousVersion ? previousVersion.version + 1 : 1,
      uploadedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: "Document",
    entityId: document.id,
    clientId,
    summary: `${user.fullName} uploaded ${document.title}`,
    metadata: {
      category,
      sizeBytes: file.size,
      version: document.version,
    },
  });

  revalidatePath("/documents");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (providerId) revalidatePath(`/providers/${providerId}`);

  return {};
}
