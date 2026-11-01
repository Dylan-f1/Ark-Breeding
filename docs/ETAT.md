# État du projet

Mis à jour le 01/11/2026. Le journal des décisions est le cahier des charges (§ Décisions,
`CAHIER-DES-CHARGES.md`) ; ce fichier dit où on en est.

## Reprendre ici

- **Objectif en cours** : PR de la première refonte du design vers dev (branche
  `feature/refonte-design`) : direction C « Console de tribu » (D-35), Bibliothèque refaite et
  validée par Dylan, espèces sans dino retirées de la liste (D-36), plusieurs serveurs (D-37).
  Ensuite : déclinaison aux autres pages, puis la partie « style Dododex » (calculateur
  d'apprivoisement).
- **Livré** : dev sur main le 01/11/2026 (PR #37, avec #38), déploiement réussi.
- **Fait** :
  - petites améliorations : statuts retirés (D-30), le plus proche du parfait (D-31), mutations de
    couleur (D-32), renommer (D-33), accoupler depuis le plan (D-34) ;
  - rendu ARK + nuancier sur la fiche de chaque dino (carte « Couleurs ») ; la page de comparaison
    `/apercu-couleurs` a été retirée une fois le rendu ARK choisi (D-27) ;
  - images ASA hébergées avec le site (apps/web/public/creatures, 313 espèces, 35 Mo, licence MIT jointe ; 173/180 espèces du catalogue) ;
  - crédits des images dans les mentions légales ;
  - débordements mobiles corrigés (arbre généalogique, en-tête) ;
  - plusieurs serveurs (D-37) : une tribu par serveur, serveur affiché dans le menu et choisi à la
    création de la tribu (intégré à la refonte, testé en local avec une tribu supprimée ensuite).
- **Bloqué / en attente de Dylan** :
  - fusion de la PR de la refonte dans dev ;
  - infos des serveurs pour la page « Join us » (EF-19) ;
  - refonte du design global (et avec elle : export JSON/CSV, multilingue).
- **Prochaine action** : décliner la direction C aux autres pages (fiche d'un dino, plan
  d'élevage, minuteurs, tribu, espèces), une page à la fois avec Dylan. Tester sur un vrai
  téléphone ce que l'émulation ne montre pas (encoche, barre d'état, appui long). Idées en suspens : miniature dans la bibliothèque et image sur les
  pages espèces publiques. Sans image : Astral Mammoth, Astral Rock Drake, Cat, Dire Polar Bear,
  Kirayli, Scorpion, Unicorn.

## Branches et livraisons

- `main` : production (déploiement automatique à chaque fusion, `.github/workflows/deploy.yml`).
  Dernière livraison : PR #37 (01/11/2026).
- `dev` : au niveau de main depuis la PR #37 (01/11/2026).
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
