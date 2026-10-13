import {
  recomputeLevelsSchema,
  saveCreaturesSchema,
  updateCreatureSchema,
  type Creature,
  type LibraryResponse,
  type SaveCreaturesResponse,
} from "@ark-breeding/core";
import { findSpeciesById } from "@ark-breeding/core/species-data";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { requireUser } from "../auth/session";
import { runBatch } from "../db/batch";
import * as schema from "../db/schema";
import type { AppEnv } from "../env";
import { getCurrentTribe, summarizeTribe } from "../tribes";
import { parseBody } from "../validation";

function toCreature(row: schema.CreatureRow): Creature {
  const { createdBy: _createdBy, createdAt, updatedAt, ...rest } = row;
  return { ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export const creatures = new Hono<AppEnv>()
  .use(requireUser)

  // EF-10 / EF-17: the whole library of the player's tribe; filtering happens client side.
  .get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await getCurrentTribe(db, user);
    const rows = await db
      .select()
      .from(schema.creatures)
      .where(eq(schema.creatures.tribeId, tribe.id))
      .orderBy(desc(schema.creatures.updatedAt));
    return c.json<LibraryResponse>({ tribe: await summarizeTribe(db, tribe, user), creatures: rows.map(toCreature) });
  })

  // EF-06 / EF-08: saves extracted creatures. A creature already imported (same in-game id) is updated.
  .post("/", async (c) => {
    const parsed = saveCreaturesSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues.slice(0, 10) }, 400);
    const unknownSpecies = parsed.data.creatures.find((cr) => !findSpeciesById(cr.speciesId));
    if (unknownSpecies) return c.json({ error: "unknown_species", speciesId: unknownSpecies.speciesId }, 400);

    const db = c.get("db");
    const user = c.get("user")!;
    const tribe = await getCurrentTribe(db, user);
    const input = parsed.data.creatures;

    const arkIds = input.map((cr) => cr.arkId).filter((id): id is string => !!id);
    const existing = arkIds.length
      ? await db
          .select({ id: schema.creatures.id, arkId: schema.creatures.arkId })
          .from(schema.creatures)
          .where(and(eq(schema.creatures.tribeId, tribe.id), inArray(schema.creatures.arkId, arkIds)))
      : [];
    const existingByArkId = new Map(existing.map((e) => [e.arkId!, e.id]));

    const now = new Date();
    const ids: string[] = [];
    let updated = 0;
    // one statement per creature: D1 caps bound parameters per statement
    const statements = input.map((cr) => {
      const existingId = cr.arkId ? existingByArkId.get(cr.arkId) : undefined;
      if (existingId) {
        updated++;
        ids.push(existingId);
        return db
          .update(schema.creatures)
          .set({ ...cr, updatedAt: now })
          .where(eq(schema.creatures.id, existingId));
      }
      const id = crypto.randomUUID();
      ids.push(id);
      if (cr.arkId) existingByArkId.set(cr.arkId, id); // duplicates inside one request
      return db.insert(schema.creatures).values({ ...cr, id, tribeId: tribe.id, createdBy: user.id, createdAt: now, updatedAt: now });
    });
    await runBatch(db, statements);

    const saved = await db.select().from(schema.creatures).where(inArray(schema.creatures.id, ids));
    return c.json<SaveCreaturesResponse>({ created: input.length - updated, updated, creatures: saved.map(toCreature) }, 201);
  })

  // EF-05: after the server settings changed, the browser re-extracts the levels and saves them here.
  .put("/levels", async (c) => {
    const body = await parseBody(c, recomputeLevelsSchema);
    if (!body) return c.json({ error: "invalid_body" }, 400);
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    const now = new Date();
    await runBatch(db, [
      ...body.creatures.map(({ id, ...levels }) =>
        db
          .update(schema.creatures)
          .set({ ...levels, updatedAt: now })
          .where(and(eq(schema.creatures.id, id), eq(schema.creatures.tribeId, tribe.id))),
      ),
      // the library is now up to date with these settings
      ...(body.fingerprint
        ? [db.update(schema.tribes).set({ levelsFingerprint: body.fingerprint }).where(eq(schema.tribes.id, tribe.id))]
        : []),
    ]);
    return c.body(null, 204);
  })

  .patch("/:id", async (c) => {
    const parsed = updateCreatureSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    const id = c.req.param("id");

    // EF-14: a parent is another creature of the same tribe and species, of the right sex
    const parentChecks = [
      ["motherId", parsed.data.motherId, "female"],
      ["fatherId", parsed.data.fatherId, "male"],
    ] as const;
    if (parentChecks.some(([, parentId]) => parentId)) {
      const self = await db
        .select({ speciesId: schema.creatures.speciesId })
        .from(schema.creatures)
        .where(and(eq(schema.creatures.id, id), eq(schema.creatures.tribeId, tribe.id)))
        .get();
      if (!self) return c.json({ error: "not_found" }, 404);
      for (const [field, parentId, sex] of parentChecks) {
        if (!parentId) continue;
        const parent = await db
          .select({ speciesId: schema.creatures.speciesId, sex: schema.creatures.sex })
          .from(schema.creatures)
          .where(and(eq(schema.creatures.id, parentId), eq(schema.creatures.tribeId, tribe.id)))
          .get();
        if (!parent || parentId === id || parent.speciesId !== self.speciesId || (parent.sex !== sex && parent.sex !== "unknown"))
          return c.json({ error: "invalid_parent", field }, 400);
      }
    }

    const row = await db
      .update(schema.creatures)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(schema.creatures.id, c.req.param("id")), eq(schema.creatures.tribeId, tribe.id)))
      .returning()
      .get();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(toCreature(row));
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const tribe = await getCurrentTribe(db, c.get("user")!);
    const id = c.req.param("id");
    const row = await db
      .delete(schema.creatures)
      .where(and(eq(schema.creatures.id, id), eq(schema.creatures.tribeId, tribe.id)))
      .returning({ id: schema.creatures.id })
      .get();
    if (!row) return c.json({ error: "not_found" }, 404);
    // mother_id / father_id have no ON DELETE action (columns added by ALTER TABLE)
    await runBatch(db, [
      db.update(schema.creatures).set({ motherId: null }).where(eq(schema.creatures.motherId, id)),
      db.update(schema.creatures).set({ fatherId: null }).where(eq(schema.creatures.fatherId, id)),
    ]);
    return c.body(null, 204);
  });
