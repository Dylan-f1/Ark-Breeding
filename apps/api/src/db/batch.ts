import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../env";

/** D1 runs a batch atomically; drizzle wants a non-empty tuple. */
export async function runBatch(db: Database, statements: BatchItem<"sqlite">[]): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
