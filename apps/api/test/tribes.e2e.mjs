// End-to-end check of the tribe rules (EF-03, EF-04, EF-05, EF-17, EF-23 to EF-26) and of the
// account deletion (EF-20) against the
// local API. Needs `npm run dev` running; seeds three test players in the local D1 and removes them.
// Usage: npm run test:e2e -w @ark-breeding/api
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const API = "http://localhost:8787/api";
const tokens = { A: "test-token-a", B: "test-token-b", C: "test-token-c", D: "test-token-d", E: "test-token-e" };
let failures = 0;

const sql = (command) =>
  execSync(`npx wrangler d1 execute ark-breeding --local --command "${command}"`, { stdio: "pipe" });
const cleanup = () =>
  sql(
    "UPDATE users SET current_tribe_id = NULL WHERE id LIKE 'test-%'; " +
      "UPDATE tribes SET server_id = NULL WHERE server_id IN (SELECT id FROM servers WHERE owner_user_id LIKE 'test-%'); " +
      "DELETE FROM servers WHERE owner_user_id LIKE 'test-%'; " +
      // only tribes owned by test players: never a real tribe a test player joined
      "DELETE FROM tribes WHERE owner_user_id LIKE 'test-%'; " +
      "DELETE FROM users WHERE id LIKE 'test-%';",
  );
cleanup();
sql(
  Object.entries(tokens)
    .map(([who, token]) => {
      const id = `test-${who.toLowerCase()}`;
      const hash = createHash("sha256").update(token).digest("hex");
      return `INSERT INTO users (id, display_name) VALUES ('${id}', 'Testeur ${who}'); INSERT INTO sessions (id, user_id, expires_at) VALUES ('${hash}', '${id}', unixepoch() + 3600);`;
    })
    .join(" "),
);

async function call(who, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(who ? { Cookie: `session=${tokens[who]}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

function check(label, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const creature = {
  speciesId: "Rex_Character_BP", name: "Rex de B", sex: "female", status: "available", kind: "bred", level: 150,
  levelsWild: [20, 20, 149, 20, 20, 0, 0, 20, 20, 0, 0, 0], levelsMutated: Array(12).fill(0), levelsDom: Array(12).fill(0),
  statValues: [5000, 800, 10000, 180, 5000, 100, 0, 600, 2.1, 1, 0, 0], tamingEffectiveness: null, imprintingBonus: 1,
  mutationsMother: 0, mutationsFather: 0, colors: [0, 0, 0, 0, 0, 0], neutered: false, arkId: null, motherArkId: null,
  fatherArkId: null, motherName: null, fatherName: null, extractionUnique: true,
};

// EF-03
let r = await call("A", "POST", "/tribes", { name: "Le" });
check("EF-03 nom trop court refusé", r.status === 400);
r = await call("A", "POST", "/tribes", { name: "Les Rexeurs" });
check("EF-03 A crée une tribu et en est propriétaire", r.status === 201 && r.data.isOwner, r.data?.name);
r = await call("A", "GET", "/tribes");
check("la nouvelle tribu est la tribu courante de A", r.data.current.name === "Les Rexeurs" && r.data.tribes.some((t) => t.name === "Les Rexeurs"));

// EF-04
r = await call("A", "GET", "/tribes/current");
const code = r.data.invite?.code;
const days = (new Date(r.data.invite.expiresAt) - Date.now()) / 86400000;
check("EF-04 lien d'invitation valable 7 jours", !!code && days > 6.99 && days <= 7, `${days.toFixed(3)} j`);
r = await call(null, "GET", `/tribes/invite/${code}`);
check("aperçu public de l'invitation", r.status === 200 && r.data.tribeName === "Les Rexeurs" && !r.data.expired);
r = await call("B", "POST", "/tribes/join", { code });
check("EF-04 B rejoint par le lien", r.status === 200 && !r.data.isOwner);
r = await call("B", "GET", "/tribes/current");
check("B est dans la tribu (2 membres)", r.data.name === "Les Rexeurs" && r.data.members.length === 2);

// EF-17
await call("B", "POST", "/creatures", { creatures: [creature] });
r = await call("A", "GET", "/creatures");
check("EF-17 A voit la créature ajoutée par B", r.data.creatures.some((c) => c.name === "Rex de B"));

// owner-only actions
r = await call("B", "POST", "/tribes/current/invite");
check("EF-25 B (membre) ne peut pas régénérer", r.status === 403);
r = await call("B", "DELETE", `/tribes/current/members/${"test-a"}`);
check("EF-23 B (membre) ne peut pas exclure", r.status === 403);

// EF-25
r = await call("A", "POST", "/tribes/current/invite");
const newCode = r.data.invite.code;
check("EF-25 nouveau lien créé", newCode && newCode !== code);
r = await call("C", "POST", "/tribes/join", { code });
check("EF-25 l'ancien lien est refusé", r.status === 404);

// EF-05
r = await call("B", "PUT", "/tribes/current/settings", { maxWildLevel: 0 });
check("EF-05 réglages invalides refusés", r.status === 400);
const settings = r.status === 400 ? (await call("B", "GET", "/tribes/current")).data.settings : null;
settings.maxWildLevel = 180;
settings.multipliers.statMultipliers[7] = [1, 1, 1, 2];
r = await call("B", "PUT", "/tribes/current/settings", settings);
check("EF-05 un membre enregistre les réglages du serveur", r.status === 200 && r.data.settings.maxWildLevel === 180);

// EF-24
r = await call("A", "POST", "/tribes/current/transfer", { userId: "test-b" });
check("EF-24 A transfère la propriété à B", r.status === 200 && r.data.members.find((m) => m.userId === "test-b").isOwner);
r = await call("A", "GET", "/tribes/current");
check("EF-24 A redevient membre", r.data.isOwner === false);

// EF-23
r = await call("B", "DELETE", "/tribes/current/members/test-a");
check("EF-23 B (nouveau propriétaire) exclut A", r.status === 200 && r.data.members.length === 1);
r = await call("A", "GET", "/tribes/current");
check("EF-23 A n'a plus accès à la tribu", r.data.name !== "Les Rexeurs", `courante : ${r.data.name}`);
r = await call("A", "GET", "/auth/me");
check("A est prévenu de son exclusion", r.data.notices.some((n) => n.message.includes("retiré")));
await call("A", "DELETE", "/auth/notices");

// leave / expired link
r = await call("C", "POST", "/tribes/join", { code: newCode });
check("C rejoint avec le nouveau lien", r.status === 200);
r = await call("B", "POST", "/tribes/current/leave");
check("le propriétaire ne peut pas quitter sans transférer", r.status === 409);

// EF-26
r = await call("B", "DELETE", "/tribes/current", { confirmName: "les rexeurs" });
check("EF-26 suppression refusée si le nom ne correspond pas", r.status === 400);
r = await call("B", "DELETE", "/tribes/current", { confirmName: "Les Rexeurs" });
check("EF-26 B supprime la tribu", r.status === 204);
r = await call("C", "GET", "/auth/me");
check("EF-26 C est prévenu à sa visite suivante", r.data.notices.some((n) => n.message.includes("supprimée")));
r = await call("C", "GET", "/tribes/current");
check("C retombe sur une autre tribu", r.status === 200 && r.data.name !== "Les Rexeurs");
r = await call("C", "POST", "/tribes/join", { code: newCode });
check("le lien d'une tribu supprimée ne marche plus", r.status === 404);

// EF-27 / EF-28
const official = (await call("A", "GET", "/tribes")).data.current.settings;
const boosted = structuredClone(official);
boosted.maxWildLevel = 180;
r = await call("A", "POST", "/servers", { name: "Serveur e2e", settings: boosted });
check("EF-28 A publie les réglages de son serveur", r.status === 201);
const serverId = r.data.id;
r = await call("C", "POST", "/servers", { name: "serveur E2E", settings: official });
check("EF-28 un nom déjà pris est refusé (sans tenir compte de la casse)", r.status === 409);
r = await call("C", "GET", "/servers");
check("EF-27 C voit le serveur partagé, pas à lui", r.data.some((s) => s.id === serverId && !s.isMine && s.ownerName === "Testeur A"));
r = await call("C", "PUT", "/tribes/current/settings", { serverId });
check("EF-27 C choisit le serveur pour sa tribu", r.status === 200 && r.data.server?.id === serverId && r.data.settings.maxWildLevel === 180);
boosted.maxWildLevel = 210;
r = await call("C", "PATCH", `/servers/${serverId}`, { settings: boosted });
check("EF-28 seul l'auteur modifie le serveur", r.status === 403);
await call("A", "PATCH", `/servers/${serverId}`, { settings: boosted });
r = await call("C", "GET", "/tribes/current");
check("EF-27 la modification du serveur s'applique à la tribu de C", r.data.settings.maxWildLevel === 210);
r = await call("C", "PUT", "/creatures/levels", { fingerprint: "0a1b2c3d", creatures: [] });
check(
  "l'empreinte des niveaux est enregistrée sur la tribu",
  r.status === 204 && (await call("C", "GET", "/tribes")).data.current.levelsFingerprint === "0a1b2c3d",
);
r = await call("A", "DELETE", `/servers/${serverId}`);
const after = (await call("C", "GET", "/tribes/current")).data;
check("retirer le serveur : la tribu de C garde ses réglages", r.status === 204 && after.server === null && after.settings.maxWildLevel === 210);

// EF-20
r = await call("D", "POST", "/tribes", { name: "Tribu partagée" });
const shared = (await call("D", "GET", "/tribes/current")).data;
await call("E", "POST", "/tribes/join", { code: shared.invite.code });
await call("D", "POST", "/tribes", { name: "Tribu solo" });
r = await call("D", "DELETE", "/auth/account", { confirm: "oui" });
check("EF-20 suppression refusée sans le mot de confirmation", r.status === 400);
r = await call("D", "DELETE", "/auth/account", { confirm: "SUPPRIMER" });
check("EF-20 D supprime son compte", r.status === 204);
r = await call("D", "GET", "/auth/me");
check("EF-20 D ne peut plus se connecter avec sa session", r.data.user === null);
r = await call("E", "GET", "/tribes/current");
check("EF-20 la tribu partagée passe à E", r.data.name === "Tribu partagée" && r.data.isOwner && r.data.members.length === 1);
r = await call("E", "GET", "/auth/me");
check("EF-20 E est prévenu qu'il devient propriétaire", r.data.notices.some((n) => n.message.includes("propriétaire")));
const solo = JSON.parse(
  execSync(`npx wrangler d1 execute ark-breeding --local --json --command "SELECT count(*) AS n FROM tribes WHERE name = 'Tribu solo'"`, { stdio: "pipe" }).toString(),
);
check("EF-20 la tribu solo de D est supprimée de la base", solo[0].results[0].n === 0);

cleanup();
console.log(failures ? `\n${failures} échec(s)` : "\nTout est bon.");
process.exit(failures ? 1 : 0);
