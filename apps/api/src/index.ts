import type { HealthResponse } from "@ark-breeding/core";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { deleteInactiveAccounts } from "./accounts";
import { sessionMiddleware } from "./auth/session";
import * as schema from "./db/schema";
import type { AppEnv, Bindings } from "./env";
import { auth } from "./routes/auth";
import { creatures } from "./routes/creatures";
import { servers } from "./routes/servers";
import { timers } from "./routes/timers";
import { tribes } from "./routes/tribes";

// Only /api/* reaches this Worker (wrangler.jsonc `run_worker_first`); the rest is static assets.
const app = new Hono<AppEnv>().basePath("/api");

app.use(sessionMiddleware);

app.get("/health", async (c) => {
  let database: HealthResponse["database"] = "ok";
  try {
    await c.get("db").run(sql`select 1`);
  } catch {
    database = "error";
  }
  return c.json<HealthResponse>({ status: "ok", database });
});

app.route("/auth", auth);
app.route("/creatures", creatures);
app.route("/tribes", tribes);
app.route("/servers", servers);
app.route("/timers", timers);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default {
  fetch: app.fetch,
  // RSE-04: daily task (wrangler.jsonc "triggers")
  async scheduled(_controller, env) {
    const deleted = await deleteInactiveAccounts(drizzle(env.DB, { schema }));
    if (deleted) console.log(`RSE-04 : ${deleted} compte(s) inactif(s) supprimé(s)`);
  },
} satisfies ExportedHandler<Bindings>;
