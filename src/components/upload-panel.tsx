"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { uploadDocument } from "@/app/(app)/documents/actions";
import { Field, FormError, Select, TextArea, type FormState } from "@/components/form";
import { DOCUMENT_LABEL } from "@/lib/format";

/**
 * Collapsed until needed. Uploading is occasional; reading the list is not.
 */
export function UploadPanel({
  clients,
  providers,
  defaultClientId,
  defaultProviderId,
}: {
  clients: { id: string; name: string }[];
  providers: { id: string; name: string }[];
  defaultClientId?: string;
  defaultProviderId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    uploadDocument,
    {},
  );

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex rounded-[3px] bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink"
        >
          Upload document
        </button>
      </div>
    );
  }

  return (
    <section className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
        <h2 className="label">Upload a document</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[0.6875rem] tracking-wider text-muted uppercase hover:text-ink"
        >
          Close
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-5 px-4 py-5">
        <FormError message={state.error} />

        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field
            label="Title"
            name="title"
            error={state.fields?.title}
            placeholder="March EOB — UnitedHealthcare"
            required
          />
          <Select
            label="Category"
            name="category"
            defaultValue="OTHER"
            options={Object.entries(DOCUMENT_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Select
            label="Client"
            name="clientId"
            defaultValue={defaultClientId ?? ""}
            error={state.fields?.clientId}
            options={[
              { value: "", label: "None" },
              ...clients.map((client) => ({ value: client.id, label: client.name })),
            ]}
            hint="Attach to a client, a provider, or both"
          />
          <Select
            label="Provider"
            name="providerId"
            defaultValue={defaultProviderId ?? ""}
            options={[
              { value: "", label: "None" },
              ...providers.map((provider) => ({
                value: provider.id,
                label: provider.name,
              })),
            ]}
          />
          <Field
            label="File"
            name="file"
            type="file"
            error={state.fields?.file}
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.txt,.csv,.xls,.xlsx,.doc,.docx"
            required
            wide
            hint="PDF, image, or Office document. 25 MB maximum."
          />
          <TextArea
            label="Notes"
            name="notes"
            hint="Context for whoever opens this next. Never patient information."
          />
        </div>

        <UploadActions onCancel={() => setOpen(false)} />
      </form>
    </section>
  );
}

function UploadActions({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-[3px] bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-[3px] border border-line px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  );
}
