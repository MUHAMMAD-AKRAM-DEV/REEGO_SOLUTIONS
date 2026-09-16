/**
 * Phase 00 seed.
 *
 * Creates the first admin account, a reference payer list, and one example
 * client with locations and providers so the registry screens have something
 * to render. Safe to run repeatedly — everything upserts.
 *
 * Example data is clearly fictional. Delete the demo client before the agency
 * puts real practices in.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProviderType, ClientStatus, ServiceLine } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";

// Run directly by tsx rather than by Next, so nothing has loaded the env yet.
// Nearest file first — dotenv never overwrites an already-set variable.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

// Prisma 7 connects through a driver adapter, not a URL in the schema.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PAYERS = [
  { name: "Medicare Part B", payerCode: "MCRB", planType: "Medicare" },
  { name: "Texas Medicaid", payerCode: "TXMCD", planType: "Medicaid" },
  { name: "Blue Cross Blue Shield of Texas", payerCode: "BCBSTX", planType: "Commercial" },
  { name: "UnitedHealthcare", payerCode: "87726", planType: "Commercial" },
  { name: "Aetna", payerCode: "60054", planType: "Commercial" },
  { name: "Cigna", payerCode: "62308", planType: "Commercial" },
  { name: "Humana", payerCode: "61101", planType: "Commercial" },
  { name: "Tricare East", payerCode: "TREST", planType: "Government" },
];

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@agency.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is not set. Set it in .env.local before seeding — " +
        "this script will not invent a default password for an admin account.",
    );
  }

  // Seeding a remote database with only DATABASE_URL overridden silently falls
  // back to the local .env.local for these two, which is how a placeholder
  // credential ends up on a live system. Refuse rather than do that quietly.
  const isPlaceholder =
    email === "admin@agency.local" ||
    password === "change-me-before-anyone-logs-in";

  const looksRemote =
    !!process.env.DATABASE_URL &&
    !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

  if (isPlaceholder && looksRemote) {
    throw new Error(
      "Refusing to seed a placeholder administrator into a remote database.\n\n" +
        `  email:    ${email}\n` +
        "  password: the .env.example placeholder\n\n" +
        "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD for this run, e.g.\n" +
        '  $env:SEED_ADMIN_EMAIL="you@example.com"\n' +
        '  $env:SEED_ADMIN_PASSWORD="<a real password>"\n',
    );
  }

  const admin = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      fullName: "Agency Administrator",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log(`admin account ready: ${admin.email}`);

  for (const payer of PAYERS) {
    await db.payer.upsert({
      where: { name: payer.name },
      update: {},
      create: payer,
    });
  }
  console.log(`${PAYERS.length} payers ready`);

  const client = await db.client.upsert({
    where: { id: "demo-client-northside" },
    update: {},
    create: {
      id: "demo-client-northside",
      name: "Northside Family Medicine",
      legalName: "Northside Family Medicine PLLC",
      status: ClientStatus.ACTIVE,
      groupNpi: "1538293840",
      primaryContactName: "Office Manager",
      primaryContactEmail: "office@northside.example",
      pmSystemName: "AdvancedMD",
      onboardedAt: new Date("2026-01-15"),
      notes: "Example record created by the seed script. Delete before go-live.",
    },
  });

  const location = await db.location.upsert({
    where: { id: "demo-location-main" },
    update: {},
    create: {
      id: "demo-location-main",
      clientId: client.id,
      name: "Main Clinic",
      addressLine1: "4120 Hollis Avenue",
      city: "Austin",
      state: "TX",
      postalCode: "78704",
      phone: "512-555-0143",
      placeOfServiceCode: "11",
    },
  });

  const providers = [
    {
      id: "demo-provider-okonkwo",
      firstName: "Amara",
      lastName: "Okonkwo",
      credentialSuffix: "MD",
      providerType: ProviderType.MD,
      npi: "1245319870",
      taxonomyCode: "207Q00000X",
      specialty: "Family Medicine",
    },
    {
      id: "demo-provider-whitfield",
      firstName: "Sam",
      lastName: "Whitfield",
      credentialSuffix: "NP",
      providerType: ProviderType.NP,
      npi: "1679204515",
      taxonomyCode: "363L00000X",
      specialty: "Nurse Practitioner",
    },
  ];

  for (const provider of providers) {
    await db.provider.upsert({
      where: { id: provider.id },
      update: {},
      create: { ...provider, clientId: client.id, primaryLocationId: location.id },
    });
  }
  console.log(`demo client seeded with ${providers.length} providers`);

  for (const service of [ServiceLine.CHARGE_ENTRY, ServiceLine.AR_FOLLOW_UP, ServiceLine.CREDENTIALING]) {
    await db.engagement.upsert({
      where: { clientId_service: { clientId: client.id, service } },
      update: {},
      create: { clientId: client.id, service, slaDays: 2 },
    });
  }
  console.log("engagements seeded");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
