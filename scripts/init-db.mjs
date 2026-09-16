/**
 * One-time local database setup.
 *
 * Reads DATABASE_URL from .env.local, then — connecting as a Postgres
 * superuser — creates that role and database if they do not already exist.
 * Run once before the first `npm run db:migrate`.
 *
 *   PowerShell:  $env:PGPASSWORD='your-postgres-password'; npm run db:init
 *   Git Bash:    PGPASSWORD='your-postgres-password' npm run db:init
 *
 * The superuser password is read from PGPASSWORD and never written anywhere.
 */
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

const parsed = new URL(url);
const appUser = decodeURIComponent(parsed.username);
const appPassword = decodeURIComponent(parsed.password);
const appDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const host = parsed.hostname;
const port = Number(parsed.port || 5432);

const superUser = process.env.PGSUPERUSER ?? "postgres";
const superPassword = process.env.PGPASSWORD;

if (!superPassword) {
  console.error(
    "PGSUPERUSER password not provided. Set PGPASSWORD to your Postgres " +
      `superuser password (user "${superUser}") and run again.`,
  );
  process.exit(1);
}

if (!appUser || !appDatabase) {
  console.error(`DATABASE_URL is missing a username or database name: ${url}`);
  process.exit(1);
}

const admin = new pg.Client({
  host,
  port,
  user: superUser,
  password: superPassword,
  database: "postgres",
});

try {
  await admin.connect();
} catch (error) {
  console.error(
    `Could not connect to Postgres at ${host}:${port} as "${superUser}".`,
  );
  console.error(error.message);
  process.exit(1);
}

// Roles and databases are cluster-wide, so both need an existence check —
// Postgres has no CREATE ROLE IF NOT EXISTS.
const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [
  appUser,
]);

if (role.rowCount === 0) {
  await admin.query(
    `CREATE ROLE "${appUser}" WITH LOGIN PASSWORD ${literal(appPassword)}`,
  );
  console.log(`created role "${appUser}"`);
} else {
  await admin.query(
    `ALTER ROLE "${appUser}" WITH LOGIN PASSWORD ${literal(appPassword)}`,
  );
  console.log(`role "${appUser}" already existed — password synced to .env.local`);
}

const database = await admin.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  [appDatabase],
);

if (database.rowCount === 0) {
  await admin.query(`CREATE DATABASE "${appDatabase}" OWNER "${appUser}"`);
  console.log(`created database "${appDatabase}" owned by "${appUser}"`);
} else {
  console.log(`database "${appDatabase}" already existed`);
}

await admin.end();

// Prisma Migrate creates tables in the public schema, so the app role needs to
// own it. On Postgres 15+ the public schema is no longer writable by default.
const target = new pg.Client({
  host,
  port,
  user: superUser,
  password: superPassword,
  database: appDatabase,
});
await target.connect();
await target.query(`ALTER SCHEMA public OWNER TO "${appUser}"`);
await target.query(
  `GRANT ALL PRIVILEGES ON DATABASE "${appDatabase}" TO "${appUser}"`,
);
await target.end();

console.log(`\nReady. Next: npm run db:migrate && npm run db:seed`);

/** Postgres string literal with quotes doubled — passwords can contain them. */
function literal(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
