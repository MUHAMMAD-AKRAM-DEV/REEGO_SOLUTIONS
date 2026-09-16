"use client";

import { useActionState } from "react";
import type { PayerEnrollment } from "@prisma/client";

import {
  Field,
  FormActions,
  FormError,
  FormSection,
  Select,
  TextArea,
  type FormState,
} from "@/components/form";
import { ENROLLMENT_LABEL } from "@/lib/format";

/**
 * Calendar dates are stored at UTC midnight, so the value for a date input is
 * just the UTC date part. Shifting by the local offset here would move the
 * date a day for anyone not on UTC.
 */
function dateValue(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function EnrollmentForm({
  action,
  enrollment,
  providers,
  payers,
  locations,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  enrollment?: PayerEnrollment;
  providers: { id: string; name: string }[];
  payers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const error = (field: string) => state.fields?.[field];
  const value = (field: string, fallback: string | null | undefined) =>
    state.values?.[field] ?? fallback ?? "";

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-5">
      <FormError message={state.error} />

      <FormSection
        title="Who with whom"
        hint="One row per provider, per payer, per location. That combination is what a payer actually enrols."
      >
        <Select
          label="Provider"
          name="providerId"
          defaultValue={state.values?.providerId ?? enrollment?.providerId ?? ""}
          error={error("providerId")}
          options={[
            { value: "", label: "Choose a provider…" },
            ...providers.map((provider) => ({
              value: provider.id,
              label: provider.name,
            })),
          ]}
        />
        <Select
          label="Payer"
          name="payerId"
          defaultValue={state.values?.payerId ?? enrollment?.payerId ?? ""}
          error={error("payerId")}
          options={[
            { value: "", label: "Choose a payer…" },
            ...payers.map((payer) => ({ value: payer.id, label: payer.name })),
          ]}
        />
        <Select
          label="Location"
          name="locationId"
          defaultValue={state.values?.locationId ?? enrollment?.locationId ?? ""}
          error={error("locationId")}
          options={[
            { value: "", label: "Not location-specific" },
            ...locations.map((location) => ({
              value: location.id,
              label: location.name,
            })),
          ]}
        />
        <Select
          label="Status"
          name="status"
          defaultValue={state.values?.status ?? enrollment?.status ?? "NOT_STARTED"}
          options={Object.entries(ENROLLMENT_LABEL).map(([optionValue, label]) => ({
            value: optionValue,
            label,
          }))}
          error={error("status")}
          hint="Only approved and effective mean you can bill for this provider"
        />
      </FormSection>

      <FormSection title="Dates">
        <Field
          label="Submitted"
          name="submittedAt"
          type="date"
          defaultValue={state.values?.submittedAt ?? dateValue(enrollment?.submittedAt)}
          error={error("submittedAt")}
        />
        <Field
          label="Approved"
          name="approvedAt"
          type="date"
          defaultValue={state.values?.approvedAt ?? dateValue(enrollment?.approvedAt)}
          error={error("approvedAt")}
        />
        <Field
          label="Effective"
          name="effectiveAt"
          type="date"
          defaultValue={state.values?.effectiveAt ?? dateValue(enrollment?.effectiveAt)}
          error={error("effectiveAt")}
          hint="The date you can start billing from"
        />
        <Field
          label="Revalidation due"
          name="revalidationDueAt"
          type="date"
          defaultValue={
            state.values?.revalidationDueAt ?? dateValue(enrollment?.revalidationDueAt)
          }
          error={error("revalidationDueAt")}
          hint="Medicare runs a five-year cycle; Medicaid varies by state"
        />
        <Field
          label="Follow up on"
          name="followUpAt"
          type="date"
          defaultValue={state.values?.followUpAt ?? dateValue(enrollment?.followUpAt)}
          error={error("followUpAt")}
          hint="When to chase the payer next"
        />
      </FormSection>

      <FormSection title="Payer references">
        <Field
          label="PTAN / provider ID"
          name="issuedProviderId"
          defaultValue={value("issuedProviderId", enrollment?.issuedProviderId)}
          error={error("issuedProviderId")}
          hint="Issued by the payer once approved"
        />
        <Field
          label="Submission reference"
          name="submissionReference"
          defaultValue={value("submissionReference", enrollment?.submissionReference)}
          error={error("submissionReference")}
          hint="The payer's reference for the application"
        />
      </FormSection>

      <FormSection title="Notes">
        <TextArea
          label="Notes"
          name="notes"
          defaultValue={value("notes", enrollment?.notes)}
          error={error("notes")}
          hint="Who you spoke to, what they asked for, what is outstanding."
        />
      </FormSection>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
