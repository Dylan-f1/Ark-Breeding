import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { runBatch } from "./db/batch";
import * as schema from "./db/schema";
import type { Database } from "./env";

/** RSE-04: an account unused for 3 years is erased. */
const INACTIVE_AFTER_S = 3 * 365 * 24 * 60 * 60;
/** Accounts erased per run of the daily task: keeps it well within the Worker limits. */
const INACTIVE_PER_RUN = 50;

/**
 * EF-20 / RSE-04: erases an account at once. Tribes the player owns go to their oldest other
 * member (D-16), who gets `heirNotice`, so the rest of the tribe keeps its library; a tribe with
 * nobody else is deleted with its library.
 */
export async function deleteAccount(db: Database, userId: string, heirNotice: (tribeName: string) => string) {
  const owned = await db.select().from(schema.tribes).where(eq(schema.tribes.ownerUserId, userId));
  const statements: BatchItem<"sqlite">[] = [];
  for (const tribe of owned) {
    const heir = await db
      .select({ userId: schema.tribeMembers.userId })
      .from(schema.tribeMembers)
      .where(and(eq(schema.tribeMembers.tribeId, tribe.id), ne(schema.tribeMembers.userId, userId)))
      .orderBy(asc(schema.tribeMembers.createdAt))
      .get();
    if (heir) {
      statements.push(
        db.update(schema.tribes).set({ ownerUserId: heir.userId }).where(eq(schema.tribes.id, tribe.id)),
        db.insert(schema.notices).values({ id: crypto.randomUUID(), userId: heir.userId, message: heirNotice(tribe.name) }),
      );
    } else {
      statements.push(
        // users.current_tribe_id has no ON DELETE action
        db.update(schema.users).set({ currentTribeId: null }).where(eq(schema.users.currentTribeId, tribe.id)),
        db.delete(schema.tribes).where(eq(schema.tribes.id, tribe.id)),
      );
    }
  }
  // cascades: sessions, Discord link, memberships, notices; creatures keep their tribe
  statements.push(db.delete(schema.users).where(eq(schema.users.id, userId)));
  await runBatch(db, statements);
}

/** RSE-04, daily: erases the accounts with no activity (login or visit) for 3 years. */
export async function deleteInactiveAccounts(db: Database, now = Date.now()) {
  const cutoff = Math.floor(now / 1000) - INACTIVE_AFTER_S;
  const inactive = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`coalesce(${schema.users.lastSeenAt}, ${schema.users.createdAt}) < ${cutoff}`)
    .limit(INACTIVE_PER_RUN);
  for (const { id } of inactive)
    await deleteAccount(
      db,
      id,
      (tribe) => `Tu es maintenant propriétaire de la tribu « ${tribe} » : son propriétaire était inactif depuis 3 ans.`,
    );
  return inactive.length;
}
