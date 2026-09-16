"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { addLocation } from "@/app/(app)/clients/actions";
import { Field, FormError, type FormState } from "@/components/form";

/**
 * Collapsed by default. Locations are added occasionally, so the form should
 * not compete with the list of locations someone came here to read.
 */
export function AddLocationForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    addLocation.bind(null, clientId),
    {},
  );
  const error = (field: string) => state.fields?.[field];
  const value = (field: string) => state.values?.[field] ?? "";

  if (!open) {
    return (
      <div className="border-t border-line-soft px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[0.6875rem] tracking-wider text-accent-ink uppercase hover:underline"
        >
          Add location
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 border-t border-line bg-surface-2 px-4 py-5"
    >
      <FormError message={state.error} />
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field
          label="Location name"
          name="name"
          defaultValue={value("name")}
          error={error("name")}
          placeholder="Main Clinic"
          required
          autoFocus
        />
        <Field
          label="Address"
          name="addressLine1"
          defaultValue={value("addressLine1")}
          error={error("addressLine1")}
        />
        <Field label="City" name="city" defaultValue={value("city")} error={error("city")} />
        <Field label="State" name="state" defaultValue={value("state")} error={error("state")} maxLength={40} />
        <Field
          label="Postal code"
          name="postalCode"
          defaultValue={value("postalCode")}
          error={error("postalCode")}
        />
        <Field label="Phone" name="phone" defaultValue={value("phone")} error={error("phone")} />
        <Field
          label="Facility NPI"
          name="npi"
          defaultValue={value("npi")}
          error={error("npi")}
          hint="Only if this site bills under its own NPI"
          inputMode="numeric"
          maxLength={10}
        />
        <Field
          label="Place of service"
          name="placeOfServiceCode"
          defaultValue={value("placeOfServiceCode")}
          error={error("placeOfServiceCode")}
          hint="CMS code, e.g. 11 office, 21 inpatient hospital"
          maxLength={4}
        />
      </div>
      <LocationFormActions onCancel={() => setOpen(false)} />
    </form>
  );
}

/** Cancel collapses the form rather than navigating, so nothing is lost. */
function LocationFormActions({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[3px] bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add location"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-[3px] border border-line px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  );
}
