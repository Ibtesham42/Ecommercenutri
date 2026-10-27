/**
 * Turn a database failure while saving a JNV resource into a message an admin
 * can act on. Never leaks SQL/connection details — those go to the server log.
 *
 * Read-only: Postgres SQLSTATE 25006, which Prisma surfaces as a
 * PrismaClientUnknownRequestError whose message embeds the code/text (no
 * `.code` field) — e.g. a database frozen with
 * `default_transaction_read_only` during a migration.
 */
export function jnvSaveErrorMessage(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  const message = err instanceof Error ? err.message : String(err ?? "");

  if (/\b25006\b|read-only transaction/i.test(message)) {
    return "The database is in read-only maintenance mode, so the resource couldn't be saved. Your uploaded file is safe — please try again later.";
  }
  if (code === "P1001" || code === "P1002" || code === "P2024" || /can't reach database/i.test(message)) {
    return "Couldn't reach the database. Please try saving again in a moment.";
  }
  return "Couldn't save the resource. Please try again.";
}
