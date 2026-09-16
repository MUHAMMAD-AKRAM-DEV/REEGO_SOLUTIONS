import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local; plain dotenv defaults to .env. Load both, nearest
// first — dotenv never overwrites a variable that is already set.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * Prisma 7 reads the connection URL from here for CLI commands (migrate,
 * studio, db pull) rather than from the schema file. The application itself
 * gets its connection from the driver adapter in src/lib/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  // The URL is attached only when it exists. `prisma generate` needs no
  // database, and demanding the variable here made it impossible to build a
  // container image before the database had been created — the config file
  // itself refused to load. Commands that do need a connection (migrate,
  // studio) still fail clearly if it is missing.
  ...(process.env.DATABASE_URL
    ? { datasource: { url: process.env.DATABASE_URL } }
    : {}),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
