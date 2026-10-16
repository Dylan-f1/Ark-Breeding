# Ark-Breeding

Outil web d'élevage pour **ARK: Survival Ascended** : extracteur de stats, bibliothèque
partagée par tribu, plan d'élevage, généalogie et suivi des mutations. Utilisable sur mobile
comme sur PC. Nom provisoire.

> Site de fans non officiel, sans lien avec Studio Wildcard. Données d'espèces issues
> d'[ARK Smart Breeding](https://github.com/cadon/ARKStatsExtractor) (licence MIT).

Le périmètre, les exigences et la roadmap sont dans [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md).

## Stack

TypeScript · React 19 + React Router 7 · Tailwind CSS 4 + shadcn/ui · Hono sur Cloudflare
Workers · Cloudflare D1 + Drizzle ORM. Monorepo npm workspaces :

```
apps/web       front (React Router, mode SPA, pré-rendu des pages publiques)
apps/api       API Hono + base D1 ; en production, sert aussi le build du front
packages/core  logique partagée (types, extracteur, calculs d'élevage)
```

## Démarrer en local

Prérequis : Node.js 22+.

```bash
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # puis renseigner les clés Discord
npm run db:migrate:local
npm run dev
```

Le site tourne sur http://localhost:5173, l'API sur http://localhost:8787 (proxifiée sous
`/api`).

Clés Discord : créer une application sur https://discord.com/developers/applications, puis
dans **OAuth2** ajouter la redirection `http://localhost:5173/api/auth/discord/callback` et
copier le Client ID et le Client Secret dans `apps/api/.dev.vars`.

## Branches

| Branche | Rôle | Part de | Fusionne dans |
| --- | --- | --- | --- |
| `main` | Production : chaque commit est déployable | — | — |
| `dev` | Intégration : la prochaine version en cours | `main` | `main` (release) |
| `feature/<ID>-<sujet>` | Une exigence du CDC, ex. `feature/EF-08-extracteur` | `dev` | `dev` |
| `fix/<sujet>` | Correction d'un bug trouvé sur `dev` | `dev` | `dev` |
| `hotfix/<sujet>` | Correction urgente en production | `main` | `main` puis `dev` |
| `docs/<sujet>`, `chore/<sujet>` | Documentation, outillage | `dev` | `dev` |

Tout passe par une pull request : `feature/*` → `dev`, puis `dev` → `main` pour livrer une
version. Les messages de commit, en français, suivent le format `[ADD | UPDATE | FIX | DELETE] ID sujet`
et citent l'exigence traitée : `[ADD] EF-08 extracteur de niveaux`.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Front + API en parallèle |
| `npm run typecheck` | Vérification TypeScript de tous les workspaces |
| `npm run build` | Build du front |
| `npm run db:generate` | Génère une migration SQL depuis `apps/api/src/db/schema.ts` |
| `npm run db:migrate:local` | Applique les migrations sur la base D1 locale |
| `npm test` | Tests unitaires (extracteur, plan d'élevage, généalogie, réglages serveur) |
| `npm run test:e2e -w @ark-breeding/api` | Règles de tribu et suppression de compte contre l'API locale (`npm run dev` lancé) |
| `npm run db:migrate:remote` | Applique les migrations sur la base D1 de production |
| `npm run deploy` | Build + déploiement du Worker sur Cloudflare |

## Mettre en ligne (Cloudflare)

Un seul Worker sert l'API (`/api/*`) et le site. Tout tient dans l'offre gratuite.

```bash
cd apps/api
npx wrangler login                      # une fois : ouvre le navigateur sur ton compte Cloudflare
npx wrangler d1 create ark-breeding     # puis copier le database_id affiché dans wrangler.jsonc
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
cd ../..
npm run db:migrate:remote
npm run deploy                          # affiche l'adresse https://ark-breeding.<compte>.workers.dev
```

Puis, dans l'application Discord (**OAuth2 > Redirects**), ajouter
`https://<adresse du site>/api/auth/discord/callback`. En production l'adresse de retour se déduit
du site : `DISCORD_REDIRECT_URI` ne sert qu'en local, derrière Vite.

Nom de domaine : l'ajouter dans le tableau de bord Cloudflare (**Workers > ark-breeding >
Domains**), puis ajouter la redirection Discord correspondante.
Enfin, dans GitHub (**Settings > Secrets and variables > Actions > Variables**), créer la variable
`SITE_URL` (par exemple `https://ark-breeding.fr`) : liens canoniques et sitemap des pages espèces.

### Déploiement automatique

Chaque fusion dans `main` relance le déploiement (`.github/workflows/deploy.yml`) : vérifications,
tests, migrations D1 puis `npm run deploy`. Il peut aussi être lancé à la main depuis l'onglet
**Actions** de GitHub. À configurer une fois :

1. Cloudflare, **My Profile > API Tokens > Create Token** : modèle « Edit Cloudflare Workers »,
   puis ajouter la permission **Account > D1 > Edit**.
2. GitHub, **Settings > Secrets and variables > Actions > New repository secret** :
   `CLOUDFLARE_API_TOKEN` (le jeton) et `CLOUDFLARE_ACCOUNT_ID` (l'identifiant du compte, affiché
   par `npx wrangler whoami` ou dans la colonne de droite du tableau de bord Cloudflare).

Les secrets Discord restent ceux du Worker : le déploiement ne les touche pas.
