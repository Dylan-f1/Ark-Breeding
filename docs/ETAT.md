# État du projet

Mis à jour le 01/11/2026. Le journal des décisions est le cahier des charges (§ Décisions,
`CAHIER-DES-CHARGES.md`) ; ce fichier dit où on en est.

## Reprendre ici

- **Objectif en cours** : livraison de dev sur main (PR #37), tests complets faits le 01/11/2026.
  Ensuite : refonte du design global, puis la partie « style Dododex » (calculateur d'apprivoisement).
- **Fait** :
  - petites améliorations : statuts retirés (D-30), le plus proche du parfait (D-31), mutations de
    couleur (D-32), renommer (D-33), accoupler depuis le plan (D-34) ;
  - rendu ARK + nuancier sur la fiche de chaque dino (carte « Couleurs ») ; la page de comparaison
    `/apercu-couleurs` a été retirée une fois le rendu ARK choisi (D-27) ;
  - images ASA hébergées avec le site (apps/web/public/creatures, 313 espèces, 35 Mo, licence MIT jointe ; 173/180 espèces du catalogue) ;
  - crédits des images dans les mentions légales ;
  - débordements mobiles corrigés (arbre généalogique, en-tête).
- **Bloqué / en attente de Dylan** :
  - fusion de la PR #37 (puis vérifier la prod) ;
  - infos des serveurs pour la page « Join us » (EF-19) ;
  - refonte du design global (et avec elle : export JSON/CSV, multilingue).
- **Prochaine action** : après la livraison, lancer la refonte du design (références, 2–3
  directions, Dylan choisit). Idées en suspens : miniature dans la bibliothèque et image sur les
  pages espèces publiques. Sans image : Astral Mammoth, Astral Rock Drake, Cat, Dire Polar Bear,
  Kirayli, Scorpion, Unicorn.

## Branches et livraisons

- `main` : production (déploiement automatique à chaque fusion, `.github/workflows/deploy.yml`).
  Dernière livraison : PR #25 (M×n).
- `dev` : en avance sur main de EF-09, EF-21, RSE-04, EF-18, D-25 à D-34 ; livraison en cours (PR #37).
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
