"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/form";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { CredentialInput, fieldErrors, formObject } from "@/lib/validation";

export async function createCredential(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) {
    return { error: "You do not have permission to manage credentials." };
  }

  const submitted = formObject(formData);
  const parsed = CredentialInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const provider = await db.provider.findUnique({
    where: { id: parsed.data.providerId },
    select: { clientId: true, firstName: true, lastName: true },
  });
  if (!provider) return { error: "That provider no longer exists.", values: submitted };

  const credential = await db.credentialItem.create({ data: parsed.data });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: "CredentialItem",
    entityId: credential.id,
    clientId: provider.clientId,
    summary: `${user.fullName} added a ${parsed.data.type.toLowerCase().replace(/_/g, " ")} for ${provider.lastName}, ${provider.firstName}`,
    metadata: { type: parsed.data.type },
  });

  revalidatePath("/credentialing");
  revalidatePath(`/providers/${parsed.data.providerId}`);
  redirect(`/providers/${parsed.data.providerId}`);
}

export async function updateCredential(
  credentialId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) {
    return { error: "You do not have permission to manage credentials." };
  }

  const submitted = formObject(formData);
  const parsed = CredentialInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const before = await db.credentialItem.findUnique({
    where: { id: credentialId },
    include: { provider: { select: { clientId: true, firstName: true, lastName: true } } },
  });
  if (!before) return { error: "That credential no longer exists.", values: submitted };

  await db.credentialItem.update({ where: { id: credentialId }, data: parsed.data });

  const changed = Object.keys(parsed.data).filter((key) => {
    const previous = before[key as keyof typeof before];
    const next = parsed.data[key as keyof typeof parsed.data];
    if (previous instanceof Date && next instanceof Date) {
      return previous.getTime() !== next.getTime();
    }
    return previous !== next;
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "CredentialItem",
    entityId: credentialId,
    clientId: before.provider.clientId,
    summary: `${user.fullName} updated a credential for ${before.provider.lastName}, ${before.provider.firstName}`,
    metadata: { changedFields: changed },
  });

  revalidatePath("/credentialing");
  revalidatePath(`/providers/${parsed.data.providerId}`);
  redirect(`/providers/${parsed.data.providerId}`);
}

/**
 * Credentials are retired, not deleted. A lapsed licence is part of the
 * record — what matters is that it stops appearing in the expirables view.
 */
export async function retireCredential(credentialId: string) {
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) return;

  const credential = await db.credentialItem.update({
    where: { id: credentialId },
    data: { retiredAt: new Date() },
    include: { provider: { select: { id: true, clientId: true, lastName: true } } },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "CredentialItem",
    entityId: credentialId,
    clientId: credential.provider.clientId,
    summary: `${user.fullName} retired a credential for ${credential.provider.lastName}`,
    metadata: { changedFields: ["retiredAt"] },
  });

  revalidatePath("/credentialing");
  revalidatePath(`/providers/${credential.provider.id}`);
}
