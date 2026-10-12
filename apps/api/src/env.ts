import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema";

export type Database = DrizzleD1Database<typeof schema>;

// `Env` comes from `wrangler types` (wrangler.jsonc); secrets live in .dev.vars / wrangler secret.
export type Bindings = Env & {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: Database;
    user: schema.User | null;
    session: schema.Session | null;
  };
};
