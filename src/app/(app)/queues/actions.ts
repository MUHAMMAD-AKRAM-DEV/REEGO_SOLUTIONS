"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/form";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { WorkItemInput, fieldErrors, formObject } from "@/lib/validation";

/** Status transitions that should stamp a timestamp as a side effect. */
function timestampsFor(status: string) {
  if (status === "IN_PROGRESS") return { startedAt: new Date(), completedAt: null };
  if (status === "DONE" || status === "CANCELLED") return { completedAt: new Date() };
  return { completedAt: null };
}

export async function createWorkItem(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "work.assign")) {
    return { error: "You do not have permission to create work items." };
  }

  const submitted = formObject(formData);
  const parsed = WorkItemInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const item = await db.workItem.create({
    data: {
      ...parsed.data,
      arBucket: (parsed.data.arBucket || null) as never,
      ...timestampsFor(parsed.data.status),
      createdById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: "WorkItem",
    entityId: item.id,
    clientId: item.clientId,
    summary: `${user.fullName} created work item "${item.title}"`,
    metadata: { queueId: item.queueId, priority: item.priority },
  });

  revalidatePath("/queues");
  redirect(`/queues/${item.id}`);
}

export async function updateWorkItem(
  itemId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "work.assign")) {
    return { error: "You do not have permission to edit work items." };
  }

  const submitted = formObject(formData);
  const parsed = WorkItemInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const before = await db.workItem.findUnique({ where: { id: itemId } });
  if (!before) return { error: "That work item no longer exists.", values: submitted };

  const item = await db.workItem.update({
    where: { id: itemId },
    data: {
      ...parsed.data,
      arBucket: (parsed.data.arBucket || null) as never,
      // Only restamp when the status actually moved, so editing a note does
      // not reset when the work started.
      ...(before.status === parsed.data.status
        ? {}
        : timestampsFor(parsed.data.status)),
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "WorkItem",
    entityId: item.id,
    clientId: item.clientId,
    summary:
      before.status === item.status
        ? `${user.fullName} updated "${item.title}"`
        : `${user.fullName} moved "${item.title}" to ${item.status.toLowerCase().replace(/_/g, " ")}`,
    metadata: { from: before.status, to: item.status },
  });

  revalidatePath("/queues");
  revalidatePath(`/queues/${itemId}`);
  redirect(`/queues/${itemId}`);
}

/** One-click claim from the list or the detail page. */
export async function assignToMe(itemId: string) {
  const user = await requireUser();

  const item = await db.workItem.update({
    where: { id: itemId },
    data: { assigneeId: user.id },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "WorkItem",
    entityId: itemId,
    clientId: item.clientId,
    summary: `${user.fullName} took "${item.title}"`,
    metadata: { changedFields: ["assigneeId"] },
  });

  revalidatePath("/queues");
  revalidatePath(`/queues/${itemId}`);
}

export async function setWorkItemStatus(itemId: string, formData: FormData) {
  const user = await requireUser();

  const status = String(formData.get("status"));
  const allowed = [
    "OPEN",
    "IN_PROGRESS",
    "WAITING_ON_PAYER",
    "WAITING_ON_CLIENT",
    "BLOCKED",
    "DONE",
    "CANCELLED",
  ];
  if (!allowed.includes(status)) return;

  const item = await db.workItem.update({
    where: { id: itemId },
    data: { status: status as never, ...timestampsFor(status) },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "WorkItem",
    entityId: itemId,
    clientId: item.clientId,
    summary: `${user.fullName} moved "${item.title}" to ${status.toLowerCase().replace(/_/g, " ")}`,
    metadata: { changedFields: ["status"], status },
  });

  revalidatePath("/queues");
  revalidatePath(`/queues/${itemId}`);
}
