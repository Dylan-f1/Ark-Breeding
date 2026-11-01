import { createTimerSchema, type Timer } from "@ark-breeding/core";
import { and, asc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/session";
import * as schema from "../db/schema";
import type { AppEnv } from "../env";
import { getCurrentTribe } from "../tribes";
import { parseBody } from "../validation";

/** Finished timers stay listed this long, then go away. */
const KEEP_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;

// D-25: breeding timers, shared by the members of the current tribe.
export const timers = new Hono<AppEnv>()
  .use(requireUser)

  .get("/", async (c) => {
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    await db
      .delete(schema.timers)
      .where(and(eq(schema.timers.tribeId, tribe.id), lt(schema.timers.endsAt, new Date(Date.now() - KEEP_FINISHED_MS))));
    const rows = await db
      .select({ timer: schema.timers, createdBy: schema.users.displayName })
      .from(schema.timers)
      .leftJoin(schema.users, eq(schema.timers.createdBy, schema.users.id))
      .where(eq(schema.timers.tribeId, tribe.id))
      .orderBy(asc(schema.timers.endsAt));
    return c.json<Timer[]>(
      rows.map(({ timer, createdBy }) => ({
        id: timer.id,
        speciesId: timer.speciesId,
        kind: timer.kind,
        name: timer.name,
        startsAt: timer.startsAt.toISOString(),
        endsAt: timer.endsAt.toISOString(),
        cuddleInterval: timer.cuddleInterval,
        createdBy,
      })),
    );
  })

  .post("/", async (c) => {
    const body = await parseBody(c, createTimerSchema);
    if (!body) return c.json({ error: "invalid_timer" }, 400);
    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await getCurrentTribe(db, user);
    const startsAt = new Date(body.startsAt);
    const id = crypto.randomUUID();
    await db.insert(schema.timers).values({
      id,
      tribeId: tribe.id,
      createdBy: user.id,
      speciesId: body.speciesId,
      kind: body.kind,
      name: body.name,
      startsAt,
      endsAt: new Date(startsAt.getTime() + body.durationSeconds * 1000),
      cuddleInterval: body.kind === "maturation" ? body.cuddleInterval : null,
    });
    return c.json({ id }, 201);
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    const deleted = await db
      .delete(schema.timers)
      .where(and(eq(schema.timers.id, c.req.param("id")), eq(schema.timers.tribeId, tribe.id)))
      .returning({ id: schema.timers.id });
    return deleted.length ? c.body(null, 204) : c.json({ error: "not_found" }, 404);
  });
