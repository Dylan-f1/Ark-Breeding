import { sql } from "drizzle-orm";
import type { ServerSettings } from "@ark-breeding/core";
import { type AnySQLiteColumn, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  /** Tribe whose library the player is looking at (a player can belong to several). */
  currentTribeId: text("current_tribe_id").references((): AnySQLiteColumn => tribes.id, { onDelete: "set null" }),
});

// One row per external identity (Discord now, email/password later — EF-02).
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    provider: text("provider", { enum: ["discord"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("oauth_accounts_provider_user").on(t.provider, t.providerUserId),
    index("oauth_accounts_user").on(t.userId),
  ],
);

// `id` is the SHA-256 of the token stored in the cookie: a leaked table cannot be replayed.
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

// Every player gets a personal tribe on first use; the library always belongs to a tribe.
export const tribes = sqliteTable("tribes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  /** ServerSettings JSON (EF-05); null = official server. Column name kept from the first migration. */
  serverSettings: text("server_multipliers", { mode: "json" }).$type<ServerSettings>(),
  /** Invitation link token (EF-04), valid until inviteExpiresAt (7 days, EF-25 renews it). */
  inviteCode: text("invite_code").unique(),
  inviteExpiresAt: integer("invite_expires_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const tribeMembers = sqliteTable(
  "tribe_members",
  {
    tribeId: text("tribe_id")
      .notNull()
      .references(() => tribes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.tribeId, t.userId] }), index("tribe_members_user").on(t.userId)],
);

const statArray = (name: string) => text(name, { mode: "json" }).$type<number[]>().notNull();

export const creatures = sqliteTable(
  "creatures",
  {
    id: text("id").primaryKey(),
    tribeId: text("tribe_id")
      .notNull()
      .references(() => tribes.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    speciesId: text("species_id").notNull(),
    name: text("name").notNull(),
    sex: text("sex", { enum: ["male", "female", "unknown"] }).notNull(),
    status: text("status", { enum: ["available", "unavailable", "dead"] }).notNull(),
    kind: text("kind", { enum: ["wild", "tamed", "bred"] }).notNull(),
    level: integer("level").notNull(),
    levelsWild: statArray("levels_wild"),
    levelsMutated: statArray("levels_mutated"),
    levelsDom: statArray("levels_dom"),
    statValues: statArray("stat_values"),
    tamingEffectiveness: real("taming_effectiveness"),
    imprintingBonus: real("imprinting_bonus").notNull(),
    mutationsMother: integer("mutations_mother").notNull(),
    mutationsFather: integer("mutations_father").notNull(),
    colors: statArray("colors"),
    neutered: integer("neutered", { mode: "boolean" }).notNull(),
    /** In-game id from export files: re-importing the same creature updates it. */
    arkId: text("ark_id"),
    motherArkId: text("mother_ark_id"),
    fatherArkId: text("father_ark_id"),
    /** Parents chosen by hand (EF-14). No ON DELETE (added by ALTER TABLE): deleting a creature clears them. */
    motherId: text("mother_id"),
    fatherId: text("father_id"),
    motherName: text("mother_name"),
    fatherName: text("father_name"),
    extractionUnique: integer("extraction_unique", { mode: "boolean" }).notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("creatures_tribe_species").on(t.tribeId, t.speciesId),
    uniqueIndex("creatures_tribe_ark_id").on(t.tribeId, t.arkId).where(sql`ark_id is not null`),
  ],
);

// Messages shown once at the next visit (tribe deleted, excluded from a tribe).
export const notices = sqliteTable(
  "notices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("notices_user").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Tribe = typeof tribes.$inferSelect;
export type CreatureRow = typeof creatures.$inferSelect;
