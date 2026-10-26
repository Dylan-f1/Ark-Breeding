// Copies ONE player's data from the production D1 to the local one (read-only on production):
// the account, its Discord link, the tribes it belongs to with their creatures and timers, and
// the shared servers they follow. Other players' accounts are not copied (links set to NULL).
// Usage: npm run db:copy-prod -w @ark-breeding/api -- <display name>  (wrangler login on the Cloudflare account)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const name = process.argv[2];
if (!name) throw new Error("display name required");
// wrangler run by node itself: no shell, the SQL stays one argument
const wranglerMain = createRequire(join(process.cwd(), "package.json")).resolve("wrangler");
const wrangler = join(dirname(wranglerMain), "..", "bin", "wrangler.js");
const run = (args, options) => execFileSync(process.execPath, [wrangler, ...args], options);

function remote(sql) {
  const out = run(["d1", "execute", "ark-breeding", "--remote", "--json", "--command", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  if (!parsed[0]?.success) throw new Error(`query failed: ${sql}`);
  return parsed[0].results;
}

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const list = (ids) => ids.map(q).join(",");
const insert = (table, rows) =>
  rows.map((r) => `INSERT OR REPLACE INTO ${table} (${Object.keys(r).join(",")}) VALUES (${Object.values(r).map(q).join(",")});`);

const [user] = remote(`SELECT * FROM users WHERE display_name = ${q(name)}`);
if (!user) throw new Error(`no player named ${name}`);
const oauth = remote(`SELECT * FROM oauth_accounts WHERE user_id = ${q(user.id)}`);
const memberships = remote(`SELECT * FROM tribe_members WHERE user_id = ${q(user.id)}`);
const tribeIds = memberships.map((m) => m.tribe_id);
const tribes = tribeIds.length ? remote(`SELECT * FROM tribes WHERE id IN (${list(tribeIds)})`) : [];
const serverIds = [...new Set(tribes.map((t) => t.server_id).filter(Boolean))];
const servers = remote(
  `SELECT * FROM servers WHERE owner_user_id = ${q(user.id)}${serverIds.length ? ` OR id IN (${list(serverIds)})` : ""}`,
);
const creatures = tribeIds.length ? remote(`SELECT * FROM creatures WHERE tribe_id IN (${list(tribeIds)})`) : [];
// the timers table only exists once migration 0005 is in production
let timers = [];
try {
  if (tribeIds.length) timers = remote(`SELECT * FROM timers WHERE tribe_id IN (${list(tribeIds)})`);
} catch {
  timers = [];
}

// only this player exists locally: links to other accounts are cleared
const mine = (id) => (id === user.id ? id : null);
const statements = [
  "PRAGMA defer_foreign_keys = true;",
  ...insert("users", [{ ...user, current_tribe_id: null }]),
  ...insert("servers", servers.map((s) => ({ ...s, owner_user_id: mine(s.owner_user_id) }))),
  ...insert("tribes", tribes.map((t) => ({ ...t, owner_user_id: mine(t.owner_user_id) }))),
  ...insert("tribe_members", memberships),
  // the local Discord login lands on this account
  `DELETE FROM oauth_accounts WHERE provider_user_id IN (${list(oauth.map((o) => o.provider_user_id)) || "''"});`,
  ...insert("oauth_accounts", oauth),
  ...insert("creatures", creatures.map((c) => ({ ...c, created_by: mine(c.created_by) }))),
  ...insert("timers", timers.map((t) => ({ ...t, created_by: mine(t.created_by) }))),
  `UPDATE users SET current_tribe_id = ${q(user.current_tribe_id)} WHERE id = ${q(user.id)};`,
];

const file = join(tmpdir(), `ark-copy-${Date.now()}.sql`);
writeFileSync(file, statements.join("\n"));
run(["d1", "execute", "ark-breeding", "--local", "--file", file], { stdio: "pipe" });
console.log(
  JSON.stringify({ tribes: tribes.map((t) => t.name), servers: servers.map((s) => s.name), creatures: creatures.length, timers: timers.length, discord: oauth.length }),
);
