"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/form";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { ProviderInput, fieldErrors, formObject } from "@/lib/validation";

export async function createProvider(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "provider.manage")) {
    return { error: "You do not have permission to add providers." };
  }

  const submitted = formObject(formData);
  const parsed = ProviderInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const provider = await db.provider.create({ data: parsed.data });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: "Provider",
    entityId: provider.id,
    clientId: provider.clientId,
    summary: `${user.fullName} added provider ${provider.lastName}, ${provider.firstName}`,
  });

  revalidatePath("/providers");
  revalidatePath(`/clients/${provider.clientId}`);
  redirect("/providers");
}

export async function updateProvider(
  providerId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "provider.manage")) {
    return { error: "You do not have permission to edit providers." };
  }

  const submitted = formObject(formData);
  const parsed = ProviderInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const before = await db.provider.findUnique({ where: { id: providerId } });
  if (!before) return { error: "That provider no longer exists." };

  const provider = await db.provider.update({
    where: { id: providerId },
    data: parsed.data,
  });

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
    entityType: "Provider",
    entityId: provider.id,
    clientId: provider.clientId,
    summary:
      changed.length === 0
        ? `${user.fullName} saved ${provider.lastName}, ${provider.firstName} with no changes`
        : `${user.fullName} updated ${provider.lastName}, ${provider.firstName} (${changed.join(", ")})`,
    metadata: { changedFields: changed },
  });

  revalidatePath("/providers");
  revalidatePath(`/clients/${provider.clientId}`);
  redirect("/providers");
}

/**
 * Providers are deactivated, never deleted. Claims, credentials and audit
 * entries all point at them, and a provider who leaves still has history that
 * has to stay reconstructable.
 */
export async function setProviderActive(providerId: string, formData: FormData) {
  const user = await requireUser();
  if (!can(user, "provider.manage")) return;

  const isActive = formData.get("isActive") === "true";

  const provider = await db.provider.update({
    where: { id: providerId },
    data: { isActive, endDate: isActive ? null : new Date() },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "Provider",
    entityId: providerId,
    clientId: provider.clientId,
    summary: `${user.fullName} ${isActive ? "reactivated" : "deactivated"} ${provider.lastName}, ${provider.firstName}`,
    metadata: { changedFields: ["isActive"], isActive },
  });

  revalidatePath("/providers");
  revalidatePath(`/clients/${provider.clientId}`);
}
