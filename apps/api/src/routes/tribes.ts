import {
  createTribeSchema,
  deleteTribeSchema,
  joinTribeSchema,
  renameTribeSchema,
  serverSettingsSchema,
  switchTribeSchema,
  transferTribeSchema,
  type InvitePreview,
  type TribeDetail,
  type TribesResponse,
} from "@ark-breeding/core";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { requireUser } from "../auth/session";
import { runBatch } from "../db/batch";
import * as schema from "../db/schema";
import type { AppEnv } from "../env";
import { parseBody } from "../validation";
import { createTribe, getCurrentTribe, isMember, listTribes, newInvite, toTribeSummary } from "../tribes";

async function tribeDetail(c: Context<AppEnv>, tribe: schema.Tribe): Promise<TribeDetail> {
  const db = c.get("db");
  const user = c.get("user")!;
  const [members, creatures] = await Promise.all([
    db
      .select({ user: schema.users, joinedAt: schema.tribeMembers.createdAt })
      .from(schema.tribeMembers)
      .innerJoin(schema.users, eq(schema.tribeMembers.userId, schema.users.id))
      .where(eq(schema.tribeMembers.tribeId, tribe.id))
      .orderBy(asc(schema.tribeMembers.createdAt)),
    db.select({ n: count() }).from(schema.creatures).where(eq(schema.creatures.tribeId, tribe.id)).get(),
  ]);
  const inviteValid = tribe.inviteCode && tribe.inviteExpiresAt && tribe.inviteExpiresAt.getTime() > Date.now();
  return {
    ...toTribeSummary(tribe, user),
    members: members.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      isOwner: m.user.id === tribe.ownerUserId,
      joinedAt: m.joinedAt.toISOString(),
    })),
    invite: inviteValid ? { code: tribe.inviteCode!, expiresAt: tribe.inviteExpiresAt!.toISOString() } : null,
    creatureCount: creatures?.n ?? 0,
  };
}

const notOwner = (c: Context<AppEnv>) => c.json({ error: "owner_only" }, 403);

export const tribes = new Hono<AppEnv>()
  // Public: lets a player who is not logged in yet see which tribe invites them.
  .get("/invite/:code", async (c) => {
    const db = c.get("db");
    const tribe = await db.select().from(schema.tribes).where(eq(schema.tribes.inviteCode, c.req.param("code"))).get();
    if (!tribe) return c.json({ error: "not_found" }, 404);
    const members = await db.select({ n: count() }).from(schema.tribeMembers).where(eq(schema.tribeMembers.tribeId, tribe.id)).get();
    const user = c.get("user");
    return c.json<InvitePreview>({
      tribeName: tribe.name,
      memberCount: members?.n ?? 0,
      expired: !tribe.inviteExpiresAt || tribe.inviteExpiresAt.getTime() <= Date.now(),
      alreadyMember: user ? await isMember(db, tribe.id, user.id) : false,
    });
  })

  .use(requireUser)

  .get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const current = await getCurrentTribe(db, user);
    const all = await listTribes(db, user);
    return c.json<TribesResponse>({ current: toTribeSummary(current, user), tribes: all.map((t) => toTribeSummary(t, user)) });
  })

  // EF-03
  .post("/", async (c) => {
    const body = await parseBody(c, createTribeSchema);
    if (!body) return c.json({ error: "invalid_name" }, 400);
    const tribe = await createTribe(c.get("db"), c.get("user")!, body.name);
    return c.json(toTribeSummary(tribe, c.get("user")!), 201);
  })

  .put("/current", async (c) => {
    const body = await parseBody(c, switchTribeSchema);
    const db = c.get("db");
    const user = c.get("user")!;
    if (!body || !(await isMember(db, body.tribeId, user.id))) return c.json({ error: "not_member" }, 403);
    await db.update(schema.users).set({ currentTribeId: body.tribeId }).where(eq(schema.users.id, user.id));
    return c.body(null, 204);
  })

  .get("/current", async (c) => c.json<TribeDetail>(await tribeDetail(c, await getCurrentTribe(c.get("db"), c.get("user")!))))

  .patch("/current", async (c) => {
    const body = await parseBody(c, renameTribeSchema);
    if (!body) return c.json({ error: "invalid_name" }, 400);
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    if (tribe.ownerUserId !== c.get("user")!.id) return notOwner(c);
    await db.update(schema.tribes).set({ name: body.name }).where(eq(schema.tribes.id, tribe.id));
    return c.json(await tribeDetail(c, { ...tribe, name: body.name }));
  })

  // EF-05: any member can set the server settings of the tribe
  .put("/current/settings", async (c) => {
    const body = await parseBody(c, serverSettingsSchema);
    if (!body) return c.json({ error: "invalid_settings" }, 400);
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    await db.update(schema.tribes).set({ serverSettings: body }).where(eq(schema.tribes.id, tribe.id));
    return c.json(await tribeDetail(c, { ...tribe, serverSettings: body }));
  })

  // EF-25: a new link, the old one is refused from now on
  .post("/current/invite", async (c) => {
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    if (tribe.ownerUserId !== c.get("user")!.id) return notOwner(c);
    const invite = newInvite();
    await db.update(schema.tribes).set(invite).where(eq(schema.tribes.id, tribe.id));
    return c.json(await tribeDetail(c, { ...tribe, ...invite }));
  })

  // EF-04
  .post("/join", async (c) => {
    const body = await parseBody(c, joinTribeSchema);
    if (!body) return c.json({ error: "invalid_code" }, 400);
    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await db.select().from(schema.tribes).where(eq(schema.tribes.inviteCode, body.code)).get();
    if (!tribe) return c.json({ error: "not_found" }, 404);
    const already = await isMember(db, tribe.id, user.id);
    if (!already && (!tribe.inviteExpiresAt || tribe.inviteExpiresAt.getTime() <= Date.now()))
      return c.json({ error: "invite_expired" }, 410);
    await runBatch(db, [
      ...(already ? [] : [db.insert(schema.tribeMembers).values({ tribeId: tribe.id, userId: user.id })]),
      db.update(schema.users).set({ currentTribeId: tribe.id }).where(eq(schema.users.id, user.id)),
    ]);
    return c.json(toTribeSummary(tribe, user));
  })

  // EF-23 (owner excludes someone)
  .delete("/current/members/:userId", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await getCurrentTribe(db, user);
    const target = c.req.param("userId");
    if (tribe.ownerUserId !== user.id) return notOwner(c);
    if (target === user.id) return c.json({ error: "owner_cannot_leave" }, 409);
    if (!(await isMember(db, tribe.id, target))) return c.json({ error: "not_member" }, 404);
    await db.batch([
      db.delete(schema.tribeMembers).where(and(eq(schema.tribeMembers.tribeId, tribe.id), eq(schema.tribeMembers.userId, target))),
      db
        .update(schema.users)
        .set({ currentTribeId: null })
        .where(and(eq(schema.users.id, target), eq(schema.users.currentTribeId, tribe.id))),
      db.insert(schema.notices).values({
        id: crypto.randomUUID(),
        userId: target,
        message: `Tu as été retiré de la tribu « ${tribe.name} ».`,
      }),
    ]);
    return c.json(await tribeDetail(c, tribe));
  })

  // A member leaves; the owner has to hand the tribe over (EF-24) or delete it (EF-26) first.
  .post("/current/leave", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await getCurrentTribe(db, user);
    if (tribe.ownerUserId === user.id) return c.json({ error: "owner_cannot_leave" }, 409);
    await db.batch([
      db.delete(schema.tribeMembers).where(and(eq(schema.tribeMembers.tribeId, tribe.id), eq(schema.tribeMembers.userId, user.id))),
      db.update(schema.users).set({ currentTribeId: null }).where(eq(schema.users.id, user.id)),
    ]);
    return c.body(null, 204);
  })

  // EF-24
  .post("/current/transfer", async (c) => {
    const body = await parseBody(c, transferTribeSchema);
    if (!body) return c.json({ error: "invalid_body" }, 400);
    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await getCurrentTribe(db, user);
    if (tribe.ownerUserId !== user.id) return notOwner(c);
    if (body.userId === user.id || !(await isMember(db, tribe.id, body.userId))) return c.json({ error: "not_member" }, 400);
    await db.update(schema.tribes).set({ ownerUserId: body.userId }).where(eq(schema.tribes.id, tribe.id));
    return c.json(await tribeDetail(c, { ...tribe, ownerUserId: body.userId }));
  })

  // EF-26: the owner types the tribe name to confirm; members are told at their next visit
  .delete("/current", async (c) => {
    const body = await parseBody(c, deleteTribeSchema);
    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await getCurrentTribe(db, user);
    if (tribe.ownerUserId !== user.id) return notOwner(c);
    if (!body || body.confirmName.trim() !== tribe.name) return c.json({ error: "confirmation_mismatch" }, 400);

    const others = await db
      .select({ userId: schema.tribeMembers.userId })
      .from(schema.tribeMembers)
      .where(and(eq(schema.tribeMembers.tribeId, tribe.id), ne(schema.tribeMembers.userId, user.id)));
    const noticeRows = others.map((o) => ({
      id: crypto.randomUUID(),
      userId: o.userId,
      message: `La tribu « ${tribe.name} » a été supprimée par son propriétaire.`,
    }));

    await runBatch(db, [
      // users.current_tribe_id has no ON DELETE action (column added by ALTER TABLE)
      db.update(schema.users).set({ currentTribeId: null }).where(eq(schema.users.currentTribeId, tribe.id)),
      ...noticeRows.map((n) => db.insert(schema.notices).values(n)),
      db.delete(schema.tribes).where(eq(schema.tribes.id, tribe.id)),
    ]);
    return c.body(null, 204);
  });
