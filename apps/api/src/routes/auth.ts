import { deleteAccountSchema, type MeResponse, type Notice, type PublicUser } from "@ark-breeding/core";
import { Discord, generateCodeVerifier, generateState } from "arctic";
import { and, asc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  createSession,
  deleteSessionCookie,
  invalidateSession,
  isSecureRequest,
  setSessionCookie,
} from "../auth/session";
import { deleteAccount } from "../accounts";
import * as schema from "../db/schema";
import type { AppEnv } from "../env";
import { parseBody } from "../validation";

const STATE_COOKIE = "discord_oauth_state";
const VERIFIER_COOKIE = "discord_code_verifier";
const RETURN_COOKIE = "login_return_to";
const AFTER_LOGIN = "/bibliotheque";
const LOGIN_ERROR = "/connexion?erreur=discord";

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

// The callback lives on the site itself; register https://<site>/api/auth/discord/callback in the
// Discord application. DISCORD_REDIRECT_URI overrides it in local dev, where wrangler sees its own
// port behind the Vite proxy.
const discordClient = (c: Context<AppEnv>) =>
  new Discord(
    c.env.DISCORD_CLIENT_ID,
    c.env.DISCORD_CLIENT_SECRET,
    c.env.DISCORD_REDIRECT_URI || new URL("/api/auth/discord/callback", c.req.url).toString(),
  );

/** Only same-site paths, e.g. an invitation page: never an open redirect. */
function safeReturnPath(path: string | undefined): string | null {
  return path && /^\/[a-z0-9/_-]*$/i.test(path) && !path.startsWith("//") ? path : null;
}

export function toPublicUser(user: schema.User): PublicUser {
  return { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl };
}

export const auth = new Hono<AppEnv>()
  // EF-01 — step 1: send the player to Discord with a one-time state + PKCE verifier.
  .get("/discord/login", (c) => {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    // "identify" only: no email collected (RGPD minimisation).
    const url = discordClient(c).createAuthorizationURL(state, codeVerifier, ["identify"]);

    const cookie = {
      httpOnly: true,
      secure: isSecureRequest(c),
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 10,
    } as const;
    setCookie(c, STATE_COOKIE, state, cookie);
    setCookie(c, VERIFIER_COOKIE, codeVerifier, cookie);
    // e.g. back to the invitation page the player came from (EF-04)
    const returnTo = safeReturnPath(c.req.query("retour"));
    if (returnTo) setCookie(c, RETURN_COOKIE, returnTo, cookie);
    else deleteCookie(c, RETURN_COOKIE, { path: "/" });
    return c.redirect(url.toString());
  })

  // EF-01 — step 2: Discord sends the player back; find or create the account, open a session.
  .get("/discord/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const storedState = getCookie(c, STATE_COOKIE);
    const codeVerifier = getCookie(c, VERIFIER_COOKIE);
    const returnTo = safeReturnPath(getCookie(c, RETURN_COOKIE));
    deleteCookie(c, RETURN_COOKIE, { path: "/" });
    deleteCookie(c, STATE_COOKIE, { path: "/" });
    deleteCookie(c, VERIFIER_COOKIE, { path: "/" });

    if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
      return c.redirect(LOGIN_ERROR);
    }

    let discordUser: DiscordUser;
    try {
      const tokens = await discordClient(c).validateAuthorizationCode(code, codeVerifier);
      const res = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      });
      if (!res.ok) throw new Error(`Discord /users/@me returned ${res.status}`);
      discordUser = await res.json();
    } catch (err) {
      console.error("Discord login failed", err);
      return c.redirect(LOGIN_ERROR);
    }

    const db = c.get("db");
    const displayName = discordUser.global_name ?? discordUser.username;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    const account = await db
      .select({ userId: schema.oauthAccounts.userId })
      .from(schema.oauthAccounts)
      .where(
        and(
          eq(schema.oauthAccounts.provider, "discord"),
          eq(schema.oauthAccounts.providerUserId, discordUser.id),
        ),
      )
      .get();

    let userId: string;
    if (account) {
      userId = account.userId;
      await db
        .update(schema.users)
        .set({ displayName, avatarUrl, lastSeenAt: new Date() })
        .where(eq(schema.users.id, userId));
    } else {
      userId = crypto.randomUUID();
      await db.batch([
        db.insert(schema.users).values({ id: userId, displayName, avatarUrl, lastSeenAt: new Date() }),
        db.insert(schema.oauthAccounts).values({
          provider: "discord",
          providerUserId: discordUser.id,
          userId,
        }),
      ]);
    }

    const { token, expiresAt } = await createSession(db, userId);
    setSessionCookie(c, token, expiresAt);
    return c.redirect(returnTo ?? AFTER_LOGIN);
  })

  .get("/me", async (c) => {
    const user = c.get("user");
    if (!user) return c.json<MeResponse>({ user: null, notices: [] });
    const notices = await c
      .get("db")
      .select()
      .from(schema.notices)
      .where(eq(schema.notices.userId, user.id))
      .orderBy(asc(schema.notices.createdAt));
    return c.json<MeResponse>({
      user: toPublicUser(user),
      notices: notices.map((n): Notice => ({ id: n.id, message: n.message, createdAt: n.createdAt.toISOString() })),
    });
  })

  // The notices were shown: drop them.
  .delete("/notices", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    await c.get("db").delete(schema.notices).where(eq(schema.notices.userId, user.id));
    return c.body(null, 204);
  })

  .post("/logout", async (c) => {
    const session = c.get("session");
    if (session) await invalidateSession(c.get("db"), session.id);
    deleteSessionCookie(c);
    return c.body(null, 204);
  })

  // EF-20: erases the account at once (tribes: see deleteAccount, D-16).
  .delete("/account", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    if (!(await parseBody(c, deleteAccountSchema))) return c.json({ error: "confirmation_required" }, 400);
    const db = c.get("db");

    await deleteAccount(
      db,
      user.id,
      (tribe) => `Tu es maintenant propriétaire de la tribu « ${tribe} » : son propriétaire a supprimé son compte.`,
    );

    deleteSessionCookie(c);
    return c.body(null, 204);
  });
