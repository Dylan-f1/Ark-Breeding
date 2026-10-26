# État du projet

Mis à jour le 26/10/2026. Le journal des décisions est le cahier des charges (§ Décisions,
`CAHIER-DES-CHARGES.md`) ; ce fichier dit où on en est.

## Reprendre ici

- **Objectif en cours** : aperçu des couleurs des créatures (EF-22) avec le rendu ARK, comme ASB
  (D-27), sur la branche `feature/apercu-couleurs`.
- **Fait** :
  - page de propositions `/apercu-couleurs` (6 designs, dont le rendu ARK) ;
  - rendu ARK + nuancier sur la fiche de chaque dino (carte « Couleurs ») ;
  - images ASA hébergées avec le site (apps/web/public/creatures, 313 espèces, 35 Mo, licence MIT jointe ; 173/180 espèces du catalogue) ;
  - crédits des images dans les mentions légales ;
  - débordements mobiles corrigés (arbre généalogique, en-tête).
- **Bloqué / en attente de Dylan** :
  - infos des serveurs pour la page « Join us » (EF-19) ;
  - refonte du design global (et avec elle : export JSON/CSV, multilingue).
- **Prochaine action** : Dylan juge le rendu sur la PR de `feature/apercu-couleurs` ; ensuite,
  miniature dans la bibliothèque et image sur les pages espèces publiques (couleurs naturelles) ?
  Sans image : Astral Mammoth, Astral Rock Drake, Cat, Dire Polar Bear, Kirayli, Scorpion, Unicorn.

## Branches et livraisons

- `main` : production (déploiement automatique à chaque fusion, `.github/workflows/deploy.yml`).
  Dernière livraison : PR #25 (M×n).
- `dev` : contient en plus EF-09, EF-21, RSE-04, EF-18 (pages espèces), minuteurs (D-25,
  migration 0005), D-26 (mutations gardées, suppression groupée). **À livrer** après la PR #32
  (dev ne compilait plus : export des minuteurs perdu à une fusion, zod 3 au lieu de 4).
- Données de test : `npm run db:copy-prod -w @ark-breeding/api -- <pseudo>` copie les données d'un
  joueur de la prod vers la base locale (fait pour Batdark le 26/10/2026).

## Repoussé

- Email + mot de passe (EF-02) : après l'achat du nom de domaine (Resend demande un domaine).
- ASE : « bien plus tard » (Dylan, 20/10/2026).
- Export JSON/CSV et multilingue : avec la refonte du design.
- ENF-07 (comparaison avec ASB sur 50 exports) : attend des exports de Dylan.

## Design

Pas encore de doc design : la refonte globale est à faire. Le site garde pour l'instant le thème
shadcn par défaut. Avant la refonte, appliquer `~/.claude/studio/ANTI_IA.md` (références réelles,
2–3 directions, choix de Dylan).
