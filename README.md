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
| `npm run deploy` | Build + déploiement du Worker sur Cloudflare |
