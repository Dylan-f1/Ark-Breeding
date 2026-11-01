import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { AppEnv, Database } from "../env";

const SESSION_COOKIE = "session";
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * DAY_MS;
// Sessions used in their last 15 days are pushed back to a full 30 days.
const SESSION_RENEW_MS = 15 * DAY_MS;

export function isSecureRequest(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(db: Database, userId: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ id: await hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

async function validateSessionToken(db: Database, token: string) {
  const sessionId = await hashToken(token);
  const row = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, sessionId))
    .get();
  if (!row) return null;

  const now = Date.now();
  if (row.session.expiresAt.getTime() <= now) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
    return null;
  }
  if (row.session.expiresAt.getTime() - now < SESSION_RENEW_MS) {
    row.session.expiresAt = new Date(now + SESSION_TTL_MS);
    await db
      .update(schema.sessions)
      .set({ expiresAt: row.session.expiresAt })
      .where(eq(schema.sessions.id, sessionId));
    // RSE-04: a player who stays signed in is active too (at most one write every 15 days)
    await db.update(schema.users).set({ lastSeenAt: new Date(now) }).where(eq(schema.users.id, row.user.id));
  }
  return row;
}

export async function invalidateSession(db: Database, sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function deleteSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

// Attaches the Drizzle client and the current user (or null) to every request.
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("db", db);
  c.set("user", null);
  c.set("session", null);

  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const result = await validateSessionToken(db, token);
    if (result) {
      c.set("user", result.user);
      c.set("session", result.session);
      setSessionCookie(c, token, result.session.expiresAt);
    } else {
      deleteSessionCookie(c);
    }
  }
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) return c.json({ error: "unauthorized" }, 401);
  await next();
});
