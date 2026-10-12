# Ark-breeding

Site web d'élevage pour ARK Survival Ascended : extracteur de stats, bibliothèque partagée par
tribu, plan d'élevage, généalogie. Refonte web d'ARK Smart Breeding (ASB). Nom provisoire.

## Stack

Tout est en **TypeScript** et hébergé sur **Cloudflare**.

| Couche | Techno | Où |
| --- | --- | --- |
| Front | React 19 + React Router 7 (framework mode, `ssr: false`, pré-rendu des pages publiques) | `apps/web` |
| UI | Tailwind CSS 4 + shadcn/ui | `apps/web` |
| API | Hono sur Cloudflare Workers | `apps/api` |
| Base | Cloudflare D1 (SQLite) + Drizzle ORM, migrations dans `apps/api/drizzle` | `apps/api` |
| Logique partagée | Types, extracteur de stats, calculs d'élevage (aucune dépendance runtime) | `packages/core` |

Monorepo **npm workspaces**. En production, un seul Worker (`apps/api`) sert l'API sur
`/api/*` et le build statique du front pour tout le reste : même origine, pas de CORS, cookies
de session simples. En dev, Vite (port 5173) proxifie `/api` vers `wrangler dev` (port 8787).

## Commandes

```bash
npm install              # à la racine, installe tous les workspaces
npm run dev              # front + API en parallèle
npm run db:migrate:local # applique les migrations D1 en local
npm run typecheck        # tous les workspaces
npm run build            # build du front
npm run deploy           # build du front + déploiement du Worker
```

## Conventions

- Interface en **français** (MVP). Code, noms de variables et commits en anglais.
- Les calculs métier (extraction, scores, probabilités) vivent dans `packages/core` avec des
  tests ; le front et l'API ne font que les appeler.
- Les données d'espèces viennent d'ASB (licence MIT, `cadon/ARKStatsExtractor`) : garder
  l'attribution affichée.
- Secrets (Discord, mails) dans `apps/api/.dev.vars` en local (non versionné) et via
  `wrangler secret put` en production. Jamais dans le code.
- Commits sans ligne `Co-Authored-By`.
- Rester sur React Router 7 tant que Node local < 22.22 (React Router 8 l'exige).

## Cahier des charges

Le cahier des charges est la référence du projet. Version en vigueur : v1.0, validée par
Dylan le 12/10/2026.

@CAHIER-DES-CHARGES.md

### Règles d'équipe

- **Tracer par l'ID.** Toute tâche, branche, commit et PR cite l'exigence qu'elle traite :
  `feat(EF-03): create a tribe`. Un travail sans exigence n'est pas prioritaire.
- **Respecter le périmètre.** Avant d'implémenter une demande, vérifier qu'elle est dans le
  IN du §4 et, tant que le MVP n'est pas livré, dans les Must du §10. Si elle est en OUT,
  LATER ou Won't, le signaler au lieu de la coder.
- **Le critère d'acceptation est la définition de « fini ».** Les tests reprennent le
  Given / When / Then de l'exigence. Les seuils des ENF et des RSE sont vérifiés avant de
  déclarer une exigence terminée.
- **Changer le périmètre passe par le CDC.** Ajouter, modifier ou retirer une exigence se fait
  dans une PR dédiée qui modifie `CAHIER-DES-CHARGES.md`, ajoute une ligne au relevé de
  décisions (§14) et incrémente la version. Seul Dylan valide cette PR.
- **Un ID ne se réattribue jamais.** Une exigence abandonnée passe en `Won't`, avec sa raison.
- **Les risques se suivent.** Quand un risque du §13 se réalise, appliquer son plan de repli
  et prévenir son responsable.
