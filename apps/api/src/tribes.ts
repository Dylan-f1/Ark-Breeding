import type { TribeSummary } from "@ark-breeding/core";
import { asc, eq } from "drizzle-orm";
import * as schema from "./db/schema";
import type { Database } from "./env";

/**
 * The tribe whose library the player works in. Until tribes can be joined (J4), that is the
 * player's oldest membership; a personal tribe is created on first use.
 */
export async function getCurrentTribe(db: Database, user: schema.User): Promise<schema.Tribe> {
  const membership = await db
    .select({ tribe: schema.tribes })
    .from(schema.tribeMembers)
    .innerJoin(schema.tribes, eq(schema.tribeMembers.tribeId, schema.tribes.id))
    .where(eq(schema.tribeMembers.userId, user.id))
    .orderBy(asc(schema.tribeMembers.createdAt))
    .get();
  if (membership) return membership.tribe;

  const tribe: schema.Tribe = {
    id: crypto.randomUUID(),
    name: `Tribu de ${user.displayName}`.slice(0, 40),
    ownerUserId: user.id,
    serverMultipliers: null,
    createdAt: new Date(),
  };
  await db.batch([
    db.insert(schema.tribes).values(tribe),
    db.insert(schema.tribeMembers).values({ tribeId: tribe.id, userId: user.id }),
  ]);
  return tribe;
}

export function toTribeSummary(tribe: schema.Tribe, user: schema.User): TribeSummary {
  return { id: tribe.id, name: tribe.name, isOwner: tribe.ownerUserId === user.id };
}
