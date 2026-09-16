import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

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
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
