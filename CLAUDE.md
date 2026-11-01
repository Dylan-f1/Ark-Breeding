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
npm test                 # tests (extracteur : aller-retour sur toutes les espèces ASA)
npm run test:e2e -w @ark-breeding/api  # règles de tribu contre l'API locale (npm run dev lancé)
npm run build            # build du front
npm run deploy           # build du front + déploiement du Worker
```

## Conventions

- Interface en **français** (MVP). Code et noms de variables en anglais.
- Messages de commit en français : `[ADD | UPDATE | FIX | DELETE] ID sujet`, ex.
  `[ADD] EF-03 création d'une tribu`, corps facultatif.
- Les calculs métier (extraction, scores, probabilités) vivent dans `packages/core` avec des
  tests ; le front et l'API ne font que les appeler.
- Les données d'espèces et l'extracteur viennent d'ASB (licence MIT, `cadon/ARKStatsExtractor`).
  `npm run build:species -w @ark-breeding/core` régénère `packages/core/data/` ; la licence
  (`data/ASB-LICENSE.txt`) reste jointe et s'affiche sur la page « Mentions légales et crédits ».
  Le port garde la structure du C# d'ASB pour rester comparable : ne pas le « simplifier ».
- Secrets (Discord, mails) dans `apps/api/.dev.vars` en local (non versionné) et via
  `wrangler secret put` en production. Jamais dans le code.
- Commits sans ligne `Co-Authored-By`.
- Branches (détail dans le README) : `main` = production, `dev` = intégration. Tout travail
  part de `dev` sur `feature/<ID>-<sujet>` (ou `fix/`, `docs/`, `chore/`) et revient par PR
  dans `dev` ; `dev` → `main` par PR pour livrer. Seuls les `hotfix/` partent de `main`.
  Ne jamais commiter directement sur `main` ni `dev`.
- Rester sur React Router 7 tant que Node local < 22.22 (React Router 8 l'exige).

## Cahier des charges

Le cahier des charges est la référence du projet (v1.0 validée par Dylan le 12/10/2026, en
vigueur : v1.13). Ses décisions (§ Décisions, D-xx) servent de journal ; l'état du projet et la
section « Reprendre ici » sont dans `docs/ETAT.md`, à tenir à jour.

@CAHIER-DES-CHARGES.md

### Règles d'équipe

- **Tracer par l'ID.** Toute tâche, branche, commit et PR cite l'exigence qu'elle traite :
  `[ADD] EF-03 création d'une tribu`. Un travail sans exigence n'est pas prioritaire.
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
