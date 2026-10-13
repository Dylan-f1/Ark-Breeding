import { publishServerSchema, updateServerSchema, type SharedServer } from "@ark-breeding/core";
import { asc, count, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/session";
import { runBatch } from "../db/batch";
import * as schema from "../db/schema";
import type { AppEnv } from "../env";
import { parseBody } from "../validation";

// EF-27 / EF-28: servers whose settings are published once and followed by any tribe.
export const servers = new Hono<AppEnv>()
  .use(requireUser)

  .get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const tribeCount = db
      .select({ serverId: schema.tribes.serverId, n: count().as("n") })
      .from(schema.tribes)
      .groupBy(schema.tribes.serverId)
      .as("tribe_count");
    const rows = await db
      .select({ server: schema.servers, ownerName: schema.users.displayName, tribes: tribeCount.n })
      .from(schema.servers)
      .leftJoin(schema.users, eq(schema.servers.ownerUserId, schema.users.id))
      .leftJoin(tribeCount, eq(tribeCount.serverId, schema.servers.id))
      .orderBy(asc(sql`lower(${schema.servers.name})`));
    return c.json<SharedServer[]>(
      rows
        .map((r) => ({
          id: r.server.id,
          name: r.server.name,
          ownerName: r.ownerName,
          isMine: r.server.ownerUserId === user.id,
          tribeCount: r.tribes ?? 0,
          settings: r.server.settings,
          updatedAt: r.server.updatedAt.toISOString(),
        }))
        // the most used servers first
        .sort((a, b) => b.tribeCount - a.tribeCount),
    );
  })

  // EF-28
  .post("/", async (c) => {
    const body = await parseBody(c, publishServerSchema);
    if (!body) return c.json({ error: "invalid_server" }, 400);
    const db = c.get("db");
    const taken = await db
      .select({ id: schema.servers.id })
      .from(schema.servers)
      .where(sql`lower(${schema.servers.name}) = lower(${body.name})`)
      .get();
    if (taken) return c.json({ error: "name_taken" }, 409);
    const id = crypto.randomUUID();
    await db.insert(schema.servers).values({ id, name: body.name, settings: body.settings, ownerUserId: c.get("user")!.id });
    return c.json({ id }, 201);
  })

  // Only the player who published the server can change it; following tribes get the change.
  .patch("/:id", async (c) => {
    const body = await parseBody(c, updateServerSchema);
    if (!body) return c.json({ error: "invalid_server" }, 400);
    const db = c.get("db");
    const server = await db.select().from(schema.servers).where(eq(schema.servers.id, c.req.param("id"))).get();
    if (!server) return c.json({ error: "not_found" }, 404);
    if (server.ownerUserId !== c.get("user")!.id) return c.json({ error: "owner_only" }, 403);
    if (body.name && body.name.toLowerCase() !== server.name.toLowerCase()) {
      const taken = await db
        .select({ id: schema.servers.id })
        .from(schema.servers)
        .where(sql`lower(${schema.servers.name}) = lower(${body.name})`)
        .get();
      if (taken) return c.json({ error: "name_taken" }, 409);
    }
    await db
      .update(schema.servers)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.servers.id, server.id));
    return c.body(null, 204);
  })

  // Removing a server: tribes that followed it keep a copy of its settings.
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const server = await db.select().from(schema.servers).where(eq(schema.servers.id, c.req.param("id"))).get();
    if (!server) return c.json({ error: "not_found" }, 404);
    if (server.ownerUserId !== c.get("user")!.id) return c.json({ error: "owner_only" }, 403);
    await runBatch(db, [
      // tribes.server_id has no ON DELETE action (column added by ALTER TABLE)
      db.update(schema.tribes).set({ serverSettings: server.settings, serverId: null }).where(eq(schema.tribes.serverId, server.id)),
      db.delete(schema.servers).where(eq(schema.servers.id, server.id)),
    ]);
    return c.body(null, 204);
  });
