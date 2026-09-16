/**
 * Demo data for the documents, credentialing, enrollment and work-queue
 * modules. Dates are relative to today, so the expirables view always has
 * something overdue, something urgent and something comfortable in it.
 *
 * Safe to re-run — everything checks for an existing row first. Delete this
 * data before real practices go in.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function inDays(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

const QUEUES = [
  { key: "ar-follow-up", name: "AR follow-up", service: "AR_FOLLOW_UP", sortOrder: 1, defaultSlaDays: 2 },
  { key: "denials", name: "Denial management", service: "DENIAL_MANAGEMENT", sortOrder: 2, defaultSlaDays: 3 },
  { key: "charge-entry", name: "Charge entry", service: "CHARGE_ENTRY", sortOrder: 3, defaultSlaDays: 1 },
  { key: "credentialing", name: "Credentialing", service: "CREDENTIALING", sortOrder: 4, defaultSlaDays: 5 },
];

async function main() {
  const providers = await db.provider.findMany({ orderBy: { lastName: "asc" } });
  if (providers.length === 0) {
    console.log("No providers found. Run `npm run db:seed` first.");
    return;
  }

  const payers = await db.payer.findMany({ orderBy: { name: "asc" } });
  const okonkwo = providers.find((p) => p.lastName === "Okonkwo") ?? providers[0]!;
  const whitfield = providers.find((p) => p.lastName === "Whitfield") ?? providers[0]!;

  for (const queue of QUEUES) {
    await db.workQueue.upsert({
      where: { key: queue.key },
      update: {},
      create: {
        key: queue.key,
        name: queue.name,
        service: queue.service as never,
        sortOrder: queue.sortOrder,
        defaultSlaDays: queue.defaultSlaDays,
      },
    });
  }
  const queues = await db.workQueue.findMany();
  const byKey = Object.fromEntries(queues.map((queue) => [queue.key, queue]));
  console.log(`${queues.length} work queues ready`);

  // Spread across overdue / critical / due-soon / comfortable on purpose.
  const credentials = [
    { providerId: okonkwo.id, type: "CAQH_ATTESTATION", issuingAuthority: "CAQH ProView", identifier: "14829301", state: null, expires: inDays(6) },
    { providerId: okonkwo.id, type: "STATE_LICENSE", issuingAuthority: "Texas Medical Board", identifier: "K9921", state: "TX", expires: inDays(126) },
    { providerId: okonkwo.id, type: "BOARD_CERTIFICATION", issuingAuthority: "ABFM", identifier: "BC-44120", state: null, expires: inDays(402) },
    { providerId: okonkwo.id, type: "MALPRACTICE_COVERAGE", issuingAuthority: "Coverys", identifier: "POL-338271", state: null, expires: inDays(73) },
    { providerId: whitfield.id, type: "DEA_REGISTRATION", issuingAuthority: "DEA", identifier: "MW4417283", state: "TX", expires: inDays(23) },
    { providerId: whitfield.id, type: "STATE_LICENSE", issuingAuthority: "Texas Board of Nursing", identifier: "RN-772041", state: "TX", expires: inDays(-12) },
    { providerId: whitfield.id, type: "BLS_ACLS", issuingAuthority: "American Heart Association", identifier: "AHA-91827", state: null, expires: inDays(210) },
  ];

  for (const credential of credentials) {
    const existing = await db.credentialItem.findFirst({
      where: { providerId: credential.providerId, type: credential.type as never },
    });
    if (existing) continue;
    await db.credentialItem.create({
      data: {
        providerId: credential.providerId,
        type: credential.type as never,
        issuingAuthority: credential.issuingAuthority,
        identifier: credential.identifier,
        state: credential.state,
        issuedAt: inDays(-700),
        expiresAt: credential.expires,
      },
    });
  }
  await db.provider.update({
    where: { id: okonkwo.id },
    data: { caqhProviderId: "14829301" },
  });
  console.log(`${credentials.length} credentials ready`);

  const statuses = [
    "EFFECTIVE", "EFFECTIVE", "UNDER_REVIEW", "INFO_REQUESTED",
    "SUBMITTED", "NOT_STARTED", "APPROVED", "REVALIDATION_DUE",
  ];

  let index = 0;
  for (const provider of providers) {
    for (const payer of payers.slice(0, 5)) {
      const status = statuses[index % statuses.length]!;
      index += 1;

      const existing = await db.payerEnrollment.findFirst({
        where: {
          providerId: provider.id,
          payerId: payer.id,
          locationId: provider.primaryLocationId,
        },
      });
      if (existing) continue;

      const settled = status === "APPROVED" || status === "EFFECTIVE";
      const inFlight =
        status === "UNDER_REVIEW" || status === "INFO_REQUESTED" || status === "SUBMITTED";

      await db.payerEnrollment.create({
        data: {
          providerId: provider.id,
          payerId: payer.id,
          locationId: provider.primaryLocationId,
          status: status as never,
          submittedAt: status === "NOT_STARTED" ? null : inDays(-90),
          approvedAt: settled ? inDays(-45) : null,
          effectiveAt: status === "EFFECTIVE" ? inDays(-30) : null,
          revalidationDueAt:
            status === "REVALIDATION_DUE"
              ? inDays(41)
              : status === "EFFECTIVE"
                ? inDays(1580)
                : null,
          // Every seventh follow-up is already late, so the "needs attention"
          // count is never zero in a demo.
          followUpAt: inFlight ? inDays(index % 7 === 0 ? -3 : 5) : null,
          issuedProviderId: settled ? `PTAN${44700 + index}` : null,
          submissionReference: status === "NOT_STARTED" ? null : `APP-${91000 + index}`,
        },
      });
    }
  }
  console.log("enrollments ready");

  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });

  const items = [
    { queue: "ar-follow-up", title: "Chase UHC on 4 unpaid claims", bucket: "AGE_91_120", amount: 41250, priority: "URGENT", status: "OPEN", due: inDays(-2), claim: "CL-88213", denial: null, providerId: null },
    { queue: "ar-follow-up", title: "Aetna underpayment review", bucket: "AGE_61_90", amount: 128400, priority: "HIGH", status: "IN_PROGRESS", due: inDays(1), claim: "CL-88410", denial: null, providerId: null },
    { queue: "denials", title: "Appeal CO-97 bundling denial", bucket: "AGE_31_60", amount: 26800, priority: "HIGH", status: "WAITING_ON_PAYER", due: inDays(4), claim: "CL-87990", denial: "CO-97", providerId: null },
    { queue: "denials", title: "Resubmit with corrected taxonomy", bucket: "AGE_0_30", amount: 9640, priority: "NORMAL", status: "OPEN", due: inDays(6), claim: "CL-88502", denial: "CO-16", providerId: null },
    { queue: "charge-entry", title: "Enter Tuesday clinic superbills", bucket: null, amount: null, priority: "NORMAL", status: "OPEN", due: inDays(0), claim: null, denial: null, providerId: null },
    { queue: "credentialing", title: "Renew Whitfield RN licence - overdue", bucket: null, amount: null, priority: "URGENT", status: "BLOCKED", due: inDays(-12), claim: null, denial: null, providerId: whitfield.id },
    { queue: "credentialing", title: "CAQH re-attestation for Okonkwo", bucket: null, amount: null, priority: "URGENT", status: "IN_PROGRESS", due: inDays(6), claim: null, denial: null, providerId: okonkwo.id },
  ];

  for (const item of items) {
    const queue = byKey[item.queue];
    if (!queue) continue;
    const existing = await db.workItem.findFirst({ where: { title: item.title } });
    if (existing) continue;

    await db.workItem.create({
      data: {
        queueId: queue.id,
        clientId: okonkwo.clientId,
        providerId: item.providerId,
        title: item.title,
        status: item.status as never,
        priority: item.priority as never,
        arBucket: item.bucket as never,
        amountCents: item.amount,
        claimRef: item.claim,
        denialCode: item.denial,
        dueAt: item.due,
        // Leaving the OPEN ones unassigned gives the "unassigned" count
        // something to show.
        assigneeId: item.status === "OPEN" ? null : (admin?.id ?? null),
        createdById: admin?.id ?? null,
      },
    });
  }
  console.log(`${items.length} work items ready`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
