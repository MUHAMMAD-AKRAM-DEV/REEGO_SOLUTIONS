"use client";

import { useActionState } from "react";
import type { WorkItem } from "@prisma/client";

import {
  Field,
  FormActions,
  FormError,
  FormSection,
  Select,
  TextArea,
  type FormState,
} from "@/components/form";
import {
  AR_BUCKET_LABEL,
  PRIORITY_LABEL,
  WORK_STATUS_LABEL,
} from "@/lib/format";

/**
 * Calendar dates are stored at UTC midnight, so the value for a date input is
 * just the UTC date part. Shifting by the local offset here would move the
 * date a day for anyone not on UTC.
 */
function dateValue(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

/** Cents in the database; a person types dollars. */
function moneyValue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export function WorkItemForm({
  action,
  item,
  queues,
  clients,
  providers,
  staff,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  item?: WorkItem;
  queues: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  providers: { id: string; name: string }[];
  staff: { id: string; fullName: string }[];
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

      <FormSection title="The work">
        <Field
          label="Title"
          name="title"
          defaultValue={value("title", item?.title)}
          error={error("title")}
          placeholder="Chase UHC on 4 unpaid claims"
          required
          autoFocus
          wide
        />
        <Select
          label="Queue"
          name="queueId"
          defaultValue={state.values?.queueId ?? item?.queueId ?? ""}
          error={error("queueId")}
          options={[
            { value: "", label: "Choose a queue…" },
            ...queues.map((queue) => ({ value: queue.id, label: queue.name })),
          ]}
        />
        <Select
          label="Client"
          name="clientId"
          defaultValue={state.values?.clientId ?? item?.clientId ?? ""}
          error={error("clientId")}
          options={[
            { value: "", label: "Choose a client…" },
            ...clients.map((client) => ({ value: client.id, label: client.name })),
          ]}
        />
        <Select
          label="Provider"
          name="providerId"
          defaultValue={state.values?.providerId ?? item?.providerId ?? ""}
          error={error("providerId")}
          options={[
            { value: "", label: "Not provider-specific" },
            ...providers.map((provider) => ({
              value: provider.id,
              label: provider.name,
            })),
          ]}
        />
        <Select
          label="Owner"
          name="assigneeId"
          defaultValue={state.values?.assigneeId ?? item?.assigneeId ?? ""}
          error={error("assigneeId")}
          options={[
            { value: "", label: "Unassigned" },
            ...staff.map((person) => ({ value: person.id, label: person.fullName })),
          ]}
        />
      </FormSection>

      <FormSection title="Tracking">
        <Select
          label="Status"
          name="status"
          defaultValue={state.values?.status ?? item?.status ?? "OPEN"}
          options={Object.entries(WORK_STATUS_LABEL).map(([optionValue, label]) => ({
            value: optionValue,
            label,
          }))}
          error={error("status")}
        />
        <Select
          label="Priority"
          name="priority"
          defaultValue={state.values?.priority ?? item?.priority ?? "NORMAL"}
          options={Object.entries(PRIORITY_LABEL).map(([optionValue, label]) => ({
            value: optionValue,
            label,
          }))}
          error={error("priority")}
        />
        <Field
          label="Due"
          name="dueAt"
          type="date"
          defaultValue={state.values?.dueAt ?? dateValue(item?.dueAt)}
          error={error("dueAt")}
          hint="Turnaround agreed with the client"
        />
      </FormSection>

      <FormSection
        title="Claim context"
        hint="Fill these in for AR and denial work. Credentialing tasks leave them empty."
      >
        <Select
          label="AR age"
          name="arBucket"
          defaultValue={state.values?.arBucket ?? item?.arBucket ?? ""}
          error={error("arBucket")}
          options={[
            { value: "", label: "Not AR work" },
            ...Object.entries(AR_BUCKET_LABEL).map(([optionValue, label]) => ({
              value: optionValue,
              label: `${label} days`,
            })),
          ]}
        />
        <Field
          label="Amount"
          name="amountCents"
          defaultValue={state.values?.amountCents ?? moneyValue(item?.amountCents)}
          error={error("amountCents")}
          placeholder="412.50"
          inputMode="decimal"
          hint="Dollars at risk on this item"
        />
        <Field
          label="Claim reference"
          name="claimRef"
          defaultValue={value("claimRef", item?.claimRef)}
          error={error("claimRef")}
        />
        <Field
          label="Denial code"
          name="denialCode"
          defaultValue={value("denialCode", item?.denialCode)}
          error={error("denialCode")}
          hint="CARC or RARC code as the payer returned it, e.g. CO-97"
        />
      </FormSection>

      <FormSection title="Detail">
        <TextArea
          label="Description"
          name="description"
          defaultValue={value("description", item?.description)}
          error={error("description")}
          hint="What has been tried, who was spoken to, what happens next. No patient information."
        />
      </FormSection>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
