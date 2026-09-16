/**
 * Removes the placeholder administrator account.
 *
 * `npm run db:seed` falls back to .env.local for the admin email and password.
 * Run against a remote database with only DATABASE_URL overridden, it happily
 * creates `admin@agency.local` with whatever placeholder password sits in the
 * local file — a known credential on a live system.
 *
 * This deletes that account, refusing to run if it is the only administrator
 * left, so nobody locks themselves out.
 *
 *   $env:DATABASE_URL="<your database url>"; node scripts/remove-default-admin.mjs
 */
import { config as loadEnv } from "dotenv";
import pg from "pg";

// Only the connection string is read from the environment; the placeholder
// address is hard-coded so this script cannot be pointed at a real account.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const PLACEHOLDER_EMAIL = "admin@agency.local";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const target = await client.query(
    'SELECT id, "fullName" FROM "User" WHERE email = $1',
    [PLACEHOLDER_EMAIL],
  );

  if (target.rowCount === 0) {
    console.log(`No ${PLACEHOLDER_EMAIL} account found — nothing to remove.`);
    process.exit(0);
  }

  const admins = await client.query(
    `SELECT email FROM "User" WHERE role = 'ADMIN' AND "isActive" = true AND email <> $1`,
    [PLACEHOLDER_EMAIL],
  );

  if (admins.rowCount === 0) {
    console.error(
      `Refusing to delete ${PLACEHOLDER_EMAIL}: it is the only active administrator.\n` +
        "Create your own admin account first, then run this again.",
    );
    process.exit(1);
  }

  console.log("Other administrators that will remain:");
  for (const row of admins.rows) console.log(`  ${row.email}`);

  // Sessions cascade with the user, so any live login is revoked too.
  await client.query('DELETE FROM "User" WHERE email = $1', [PLACEHOLDER_EMAIL]);
  console.log(`\nRemoved ${PLACEHOLDER_EMAIL}.`);
} finally {
  await client.end();
}
