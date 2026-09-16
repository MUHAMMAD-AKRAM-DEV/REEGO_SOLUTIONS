"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/form";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import {
  ClientInput,
  LocationInput,
  fieldErrors,
  formObject,
} from "@/lib/validation";

export async function createClient(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "client.manage")) {
    return { error: "You do not have permission to add clients." };
  }

  const submitted = formObject(formData);
  const parsed = ClientInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const client = await db.client.create({ data: parsed.data });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: "Client",
    entityId: client.id,
    clientId: client.id,
    summary: `${user.fullName} added client ${client.name}`,
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(
  clientId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "client.manage")) {
    return { error: "You do not have permission to edit clients." };
  }

  const submitted = formObject(formData);
  const parsed = ClientInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const before = await db.client.findUnique({ where: { id: clientId } });
  if (!before) return { error: "That client no longer exists." };

  const client = await db.client.update({
    where: { id: clientId },
    data: parsed.data,
  });

  // Record which fields moved, not their values — client records carry
  // identifiers we do not want duplicated into the log.
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
    entityType: "Client",
    entityId: client.id,
    clientId: client.id,
    summary:
      changed.length === 0
        ? `${user.fullName} saved ${client.name} with no changes`
        : `${user.fullName} updated ${client.name} (${changed.join(", ")})`,
    metadata: { changedFields: changed },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function addLocation(
  clientId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "client.manage")) {
    return { error: "You do not have permission to add locations." };
  }

  const submitted = formObject(formData);
  const parsed = LocationInput.safeParse({ ...submitted, clientId });
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const location = await db.location.create({ data: parsed.data });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: "Location",
    entityId: location.id,
    clientId,
    summary: `${user.fullName} added location ${location.name}`,
  });

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

/**
 * Clients are never deleted — offboarding preserves the history that claims,
 * documents and the audit log all reference. This flips status instead.
 */
export async function setClientStatus(clientId: string, formData: FormData) {
  const user = await requireUser();
  if (!can(user, "client.manage")) return;

  const status = String(formData.get("status"));
  const allowed = ["PROSPECT", "ONBOARDING", "ACTIVE", "PAUSED", "OFFBOARDED"];
  if (!allowed.includes(status)) return;

  const client = await db.client.update({
    where: { id: clientId },
    data: {
      status: status as (typeof allowed)[number] as never,
      offboardedAt: status === "OFFBOARDED" ? new Date() : null,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "Client",
    entityId: clientId,
    clientId,
    summary: `${user.fullName} set ${client.name} to ${status.toLowerCase()}`,
    metadata: { changedFields: ["status"], status },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}
