import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Next.js hot-reloads modules in development, which would otherwise open a new
// connection pool on every save until Postgres refuses further connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  // Prisma 7 connects through a driver adapter rather than a URL in the schema.
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

function client(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * The Prisma client, constructed on first use rather than on import.
 *
 * `next build` imports every module with no database available, so a client
 * built at import time takes the whole build down with "DATABASE_URL is not
 * set" — an error about the build environment, not about anything wrong with
 * the code. Deferring construction means a missing variable surfaces at the
 * first query, where the message is actually true and actionable.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const value = Reflect.get(client(), property, receiver);
    // Methods must keep their `this`, or every query throws on an unbound call.
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
