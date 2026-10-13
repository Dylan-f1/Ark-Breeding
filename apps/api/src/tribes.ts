import { OFFICIAL_SERVER_SETTINGS, type TribeSummary } from "@ark-breeding/core";
import { and, asc, eq, inArray } from "drizzle-orm";
import * as schema from "./db/schema";
import type { Database } from "./env";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function newInvite() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { inviteCode: code, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS) };
}

export async function isMember(db: Database, tribeId: string, userId: string): Promise<boolean> {
  const row = await db
    .select({ userId: schema.tribeMembers.userId })
    .from(schema.tribeMembers)
    .where(and(eq(schema.tribeMembers.tribeId, tribeId), eq(schema.tribeMembers.userId, userId)))
    .get();
  return !!row;
}

/** EF-03: the creator is the only owner; the tribe starts with a 7-day invitation link. */
export async function createTribe(db: Database, user: schema.User, name: string): Promise<schema.Tribe> {
  const tribe: schema.Tribe = {
    id: crypto.randomUUID(),
    name,
    ownerUserId: user.id,
    serverSettings: null,
    serverId: null,
    levelsFingerprint: null,
    ...newInvite(),
    createdAt: new Date(),
  };
  await db.batch([
    db.insert(schema.tribes).values(tribe),
    db.insert(schema.tribeMembers).values({ tribeId: tribe.id, userId: user.id }),
    db.update(schema.users).set({ currentTribeId: tribe.id }).where(eq(schema.users.id, user.id)),
  ]);
  return tribe;
}

/**
 * The tribe whose library the player works in: the one picked last if still a member, else
 * the oldest membership; a personal tribe is created on first use (D-14).
 * Membership is checked on every request, so an excluded player loses access at once (EF-23).
 */
export async function getCurrentTribe(db: Database, user: schema.User): Promise<schema.Tribe> {
  const memberships = await db
    .select({ tribe: schema.tribes })
    .from(schema.tribeMembers)
    .innerJoin(schema.tribes, eq(schema.tribeMembers.tribeId, schema.tribes.id))
    .where(eq(schema.tribeMembers.userId, user.id))
    .orderBy(asc(schema.tribeMembers.createdAt));

  const current = memberships.find((m) => m.tribe.id === user.currentTribeId) ?? memberships[0];
  if (current) return current.tribe;
  return createTribe(db, user, `Tribu de ${user.displayName}`.slice(0, 40));
}

export async function listTribes(db: Database, user: schema.User): Promise<schema.Tribe[]> {
  const rows = await db
    .select({ tribe: schema.tribes })
    .from(schema.tribeMembers)
    .innerJoin(schema.tribes, eq(schema.tribeMembers.tribeId, schema.tribes.id))
    .where(eq(schema.tribeMembers.userId, user.id))
    .orderBy(asc(schema.tribeMembers.createdAt));
  return rows.map((r) => r.tribe);
}

/** Summaries with the effective settings: the shared server's when the tribe follows one (EF-27). */
export async function summarizeTribes(db: Database, tribes: schema.Tribe[], user: schema.User): Promise<TribeSummary[]> {
  const serverIds = [...new Set(tribes.map((t) => t.serverId).filter((id): id is string => !!id))];
  const servers = serverIds.length
    ? await db.select().from(schema.servers).where(inArray(schema.servers.id, serverIds))
    : [];
  const byId = new Map(servers.map((s) => [s.id, s]));
  return tribes.map((tribe) => {
    const server = tribe.serverId ? byId.get(tribe.serverId) : undefined;
    return {
      id: tribe.id,
      name: tribe.name,
      isOwner: tribe.ownerUserId === user.id,
      settings: server?.settings ?? tribe.serverSettings ?? OFFICIAL_SERVER_SETTINGS,
      server: server ? { id: server.id, name: server.name, isMine: server.ownerUserId === user.id } : null,
      levelsFingerprint: tribe.levelsFingerprint,
    };
  });
}

export async function summarizeTribe(db: Database, tribe: schema.Tribe, user: schema.User): Promise<TribeSummary> {
  return (await summarizeTribes(db, [tribe], user))[0]!;
}
