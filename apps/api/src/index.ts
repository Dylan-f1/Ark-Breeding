import type { HealthResponse } from "@ark-breeding/core";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { sessionMiddleware } from "./auth/session";
import type { AppEnv } from "./env";
import { auth } from "./routes/auth";

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

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
