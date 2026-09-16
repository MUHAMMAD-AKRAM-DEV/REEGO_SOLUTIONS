import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/app/(app)/clients/actions";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  const user = await requireUser();
  if (!can(user, "client.manage")) redirect("/clients");

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/clients" className="hover:underline">
            Clients
          </Link>
        }
        title="Add a client"
        description="A practice the agency bills for. You can add locations and providers once it exists."
      />
      <ClientForm
        action={createClient}
        submitLabel="Add client"
        cancelHref="/clients"
      />
    </>
  );
}
