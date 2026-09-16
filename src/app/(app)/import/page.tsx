import { redirect } from "next/navigation";

import { ImportWizard } from "@/components/import-wizard";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user, "client.manage")) redirect("/overview");

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Import from a spreadsheet"
        description="Bring existing data across from Excel. Nothing is written until you have seen what will happen."
      />
      <ImportWizard />
    </>
  );
}
