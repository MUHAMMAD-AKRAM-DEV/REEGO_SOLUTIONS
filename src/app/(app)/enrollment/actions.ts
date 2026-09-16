"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/form";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { EnrollmentInput, fieldErrors, formObject } from "@/lib/validation";

export async function createEnrollment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) {
    return { error: "You do not have permission to manage enrollments." };
  }

  const submitted = formObject(formData);
  const parsed = EnrollmentInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const [provider, payer] = await Promise.all([
    db.provider.findUnique({
      where: { id: parsed.data.providerId },
      select: { clientId: true, firstName: true, lastName: true },
    }),
    db.payer.findUnique({ where: { id: parsed.data.payerId }, select: { name: true } }),
  ]);
  if (!provider || !payer) {
    return { error: "That provider or payer no longer exists.", values: submitted };
  }

  // One row per provider per payer per location is a database constraint, so
  // catch the duplicate here and explain it rather than surfacing P2002.
  const duplicate = await db.payerEnrollment.findFirst({
    where: {
      providerId: parsed.data.providerId,
      payerId: parsed.data.payerId,
      locationId: parsed.data.locationId,
    },
  });
  if (duplicate) {
    return {
      error: `${provider.lastName}, ${provider.firstName} already has an enrollment with ${payer.name} at that location. Edit the existing one instead.`,
      values: submitted,
    };
  }

  const enrollment = await db.payerEnrollment.create({ data: parsed.data });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entityType: "PayerEnrollment",
    entityId: enrollment.id,
    clientId: provider.clientId,
    summary: `${user.fullName} started ${payer.name} enrollment for ${provider.lastName}, ${provider.firstName}`,
    metadata: { status: parsed.data.status },
  });

  revalidatePath("/enrollment");
  revalidatePath(`/providers/${parsed.data.providerId}`);
  redirect("/enrollment");
}

export async function updateEnrollment(
  enrollmentId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "credentialing.manage")) {
    return { error: "You do not have permission to manage enrollments." };
  }

  const submitted = formObject(formData);
  const parsed = EnrollmentInput.safeParse(submitted);
  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
      values: submitted,
    };
  }

  const before = await db.payerEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      provider: { select: { clientId: true, firstName: true, lastName: true } },
      payer: { select: { name: true } },
    },
  });
  if (!before) return { error: "That enrollment no longer exists.", values: submitted };

  await db.payerEnrollment.update({ where: { id: enrollmentId }, data: parsed.data });

  const statusChanged = before.status !== parsed.data.status;

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entityType: "PayerEnrollment",
    entityId: enrollmentId,
    clientId: before.provider.clientId,
    summary: statusChanged
      ? `${user.fullName} moved ${before.payer.name} enrollment for ${before.provider.lastName} to ${parsed.data.status.toLowerCase().replace(/_/g, " ")}`
      : `${user.fullName} updated ${before.payer.name} enrollment for ${before.provider.lastName}`,
    metadata: { from: before.status, to: parsed.data.status },
  });

  revalidatePath("/enrollment");
  revalidatePath(`/providers/${parsed.data.providerId}`);
  redirect("/enrollment");
}
