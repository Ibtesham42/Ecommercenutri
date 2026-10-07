import { PrismaClient } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { MODEL_TAGS } from "@/lib/cache";

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

function createClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  }).$extends({
    // Any write to a model backing a cached storefront read invalidates that
    // cache (see lib/cache.ts) — covers every admin action, present and future.
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          const tags = WRITE_OPERATIONS.has(operation) ? MODEL_TAGS[model] : undefined;
          if (tags) {
            for (const tag of tags) {
              try {
                revalidateTag(tag);
              } catch {
                // No request store (tsx scripts/seed): there's no Next cache to purge.
              }
            }
          }
          return result;
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createClient>;

// Reuse a single PrismaClient instance across hot reloads in development to
// avoid exhausting database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
