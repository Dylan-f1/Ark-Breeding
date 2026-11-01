---
titre: Ark-breeding (nom provisoire)
sous_titre: Cahier des charges
client: Projet personnel public — joueurs d'ARK Survival Ascended
agence: Dylan (seul)
version: "1.13"
statut: Validé par le chef d'équipe
date: 2026-10-12
auteur: Dylan Fernandes
module: Projet personnel
confidentialite: Document de projet — diffusable
---

| Version | Date | Contenu | Auteurs |
| --- | --- | --- | --- |
| v0.1 | 12/10/2026 | §1 à §14 + annexes A et B, issus de l'entretien de cadrage | Dylan, rédaction assistée par Claude |
| v1.0 | 12/10/2026 | Validation par Dylan : nom provisoire, LATER tranché, pas de recalage de l'estimation, GO | Dylan, rédaction assistée par Claude |
| v1.1 | 12/10/2026 | ENF-04 : licence MIT consultable dans les mentions légales au lieu d'un bandeau ; espèces domesticables seulement | Dylan, rédaction assistée par Claude |
| v1.2 | 12/10/2026 | D-14 : tribu personnelle créée automatiquement pour chaque joueur | Dylan, rédaction assistée par Claude |
| v1.3 | 13/10/2026 | D-15 : plusieurs tribus par joueur, quitter une tribu, réglages serveur par collage du Game.ini | Dylan, rédaction assistée par Claude |
| v1.4 | 13/10/2026 | D-16 : sort des tribus d'un compte supprimé (EF-20) | Dylan, rédaction assistée par Claude |
| v1.5 | 13/10/2026 | EF-27, EF-28 : serveurs partagés (D-17) | Dylan, rédaction assistée par Claude |
| v1.6 | 13/10/2026 | D-18 : parents reconnus d'après les stats quand l'export ne contient pas d'ascendance (EF-16) | Dylan, rédaction assistée par Claude |
| v1.7 | 14/10/2026 | Retours de la V1 : D-19 (compteurs de mutations recalculés d'après les parents), D-20 (dossier DinoExports connecté, EF-07), D-21 (toutes les espèces dans la bibliothèque, niveau du bébé dans le plan) | Dylan, rédaction assistée par Claude |
| v1.8 | 14/10/2026 | D-22 : connexion du dossier DinoExports retirée (refusée par Chrome sous Program Files), EF-07 réécrite | Dylan, rédaction assistée par Claude |
| v1.9 | 14/10/2026 | D-23 : liste des espèces limitée aux créatures possédables des cartes sorties sur ASA | Dylan, rédaction assistée par Claude |
| v1.10 | 15/10/2026 | D-24 : nombre de mutations par stat (M×n), empilées sur les générations | Dylan, rédaction assistée par Claude |
| v1.11 | 16/10/2026 | D-25 : minuteurs d'élevage, avancés du LATER | Dylan, rédaction assistée par Claude |
| v1.12 | 20/10/2026 | D-26 : mutations gardées sur les bébés, suppression groupée | Dylan, rédaction assistée par Claude |
| v1.13 | 26/10/2026 | D-27 : aperçu des couleurs par le rendu ARK (images communautaires, comme ASB) | Dylan, rédaction assistée par Claude |

## §1 · Contexte

**Le besoin réel, c'est qu'un éleveur d'ARK Survival Ascended sache en quelques secondes,
depuis n'importe quel appareil, quel couple accoupler pour progresser sur sa lignée, sans
maîtriser un outil complexe, en partageant ses données avec sa tribu.**

### L'activité

Dans ARK Survival Ascended (ASA), l'élevage consiste à accoupler des créatures pour cumuler
chez un même descendant les meilleures stats (vie, endurance, poids, attaque…) et les
mutations. Chaque stat d'une créature se décompose en points sauvages, hérités d'un parent
ou de l'autre, et en points domestiqués. Ces points ne s'affichent pas en jeu : le joueur
voit des valeurs (ex. 4 520 PV), qu'il faut convertir en points pour savoir ce qui se
transmet.

### Ce qui dysfonctionne aujourd'hui

- **ARK Smart Breeding (ASB)**, l'outil de référence, ne tourne que sous Windows. Son
  interface concentre toutes les fonctions sur un seul écran : le chef de projet la juge
  « trop d'infos, pas super fluide d'utilisation ».
- Les joueurs console et les joueurs qui consultent leur téléphone à côté du jeu n'ont pas
  accès à ASB.
- Chaque joueur garde sa bibliothèque sur son poste : la tribu ne partage pas les mêmes
  données.
- Les joueurs qui n'utilisent pas ASB bricolent avec des tableurs, Discord ou des captures
  d'écran, qui se perdent.

### L'existant

| Outil | Ce qu'il fait | Limite |
| --- | --- | --- |
| ARK Smart Breeding (ASB) | Extracteur de stats, bibliothèque, plan d'élevage, généalogie, import des exports du jeu | Windows uniquement, interface dense, aucun partage |
| Dododex, Ark Breeder (mobile) | Calculs ponctuels, minuteurs | Peu de suivi de lignées dans la durée |
| Bots Discord (Ark Breeder bot) | Lignées saisies à la main dans Discord | Pas d'extracteur, saisie en commandes |
| Tableurs | Suivi libre | Tout est manuel |

Le jeu propose une option **Exporter** sur chaque créature : elle écrit un fichier `.ini`
(nom, stats, points, couleurs, parents, mutations) dans `ShooterGame\Saved\DinoExports\`, sur
le PC qui fait tourner le jeu. Ce fichier n'existe ni sur console, ni sur mobile.

ASB est open source sous **licence MIT** (dépôt `cadon/ARKStatsExtractor`, mis à jour le
11/10/2026) : ses données de stats par espèce sont réutilisables avec attribution.

### Pourquoi maintenant

Le chef de projet joue à ASA, gère des serveurs ARK et veut à la fois un outil pour sa
communauté et un projet qui montre une chaîne front + back complète hébergée sur Cloudflare.

### Exprimé, implicite, caché

- **Exprimé** — un site plus lisible qu'ASB, utilisable sur mobile, partagé par tribu, avec
  un aperçu 3D coloré, bien référencé, qui fait connaître les serveurs du chef de projet.
- **Implicite** — l'extraction des points doit donner exactement les mêmes résultats qu'ASB,
  faute de quoi les joueurs n'auront pas confiance.
- **Caché** (déduit pendant l'entretien) — les serveurs non officiels modifient les
  multiplicateurs de stats, ce qui change le calcul ; les modèles 3D du jeu appartiennent à
  Studio Wildcard ; le fichier d'export n'existe que sur PC.

## §2 · Objectifs

| ID | Objectif SMART | Indicateur | Valeur actuelle | Cible | Échéance |
| --- | --- | --- | --- | --- | --- |
| O-01 (n°1) | Permettre d'ajouter une créature à sa bibliothèque en 30 s maximum | Durée médiane de saisie, chronométrée sur 5 joueurs | ⚠️ À COMPLÉTER — à mesurer sur ASB (estimé entre 1 et 2 min) | ≤ 30 s | Mise en ligne du MVP |
| O-02 | Apparaître en 1re ou 2e position de Google sur « ark breeding » et « smart breeding » | Position moyenne (Google Search Console) | Non classé | Top 2 | 12 mois après la mise en ligne |
| O-03 | Réunir 500 comptes actifs par mois | Comptes connectés au moins une fois dans le mois | 0 | 500 | 6 mois après la mise en ligne |
| O-04 | Réunir 50 tribus actives | Tribus d'au moins 2 membres, modifiées dans le mois | 0 | 50 | 6 mois après la mise en ligne |
| O-05 | Faire connaître les serveurs ARK du chef de projet | Clics sur le lien Discord de la page « Join us » | 0 | ⚠️ À COMPLÉTER | 6 mois après la mise en ligne de la V1 |

L'objectif n°1 est O-01 : c'est la lisibilité et la vitesse d'usage qui font revenir les
joueurs. Le MVP est construit pour le servir.

## §3 · Parties prenantes

| Partie prenante | Rôle (MOA / MOE / AMOA / DSI / sponsor / utilisateur) | Intérêt | Pouvoir | Position matrice | Attente principale |
| --- | --- | --- | --- | --- | --- |
| Dylan, chef de projet | MOA, MOE et sponsor (seul développeur) | 4 | 4 | Gérer étroitement | Un outil utilisé par sa communauté, une vitrine technique |
| Éleveurs ASA sur PC | Utilisateur | 4 | 2 | Informer | Importer leurs exports sans ressaisie |
| Éleveurs ASA sur console | Utilisateur | 4 | 1 | Informer | Saisir une créature à la main en 30 s |
| Membres d'une tribu | Utilisateur | 4 | 2 | Informer | Voir la même bibliothèque que leurs coéquipiers |
| Joueurs des serveurs de Dylan | Utilisateur, premiers testeurs | 3 | 2 | Informer | Un outil recommandé par leur serveur |
| Studio Wildcard (éditeur d'ARK) | Ayant droit | 1 | 4 | Satisfaire | Respect de la marque ARK et des assets du jeu |
| Mainteneurs d'ASB (cadon) | Fournisseur de données (licence MIT) | 2 | 3 | Satisfaire | Attribution conforme à la licence MIT |
| Cloudflare | Hébergeur (Pages, Workers, D1) | 1 | 3 | Satisfaire | Usage dans les quotas de l'offre gratuite |
| Discord | Fournisseur d'identité (OAuth) | 1 | 3 | Satisfaire | Respect des conditions de l'API |
| CNIL | Autorité de contrôle | 1 | 4 | Satisfaire | Conformité RGPD des comptes joueurs |
| Google (moteur de recherche) | Canal d'acquisition | 1 | 3 | Satisfaire | Pages indexables, contenu utile |

## §4 · Périmètre

### IN — ce qu'on livre (MVP puis V1)

- Comptes joueurs (Discord au MVP, email + mot de passe en V1) et tribus partagées.
- Extracteur de stats ASA : valeurs vues en jeu → points sauvages et domestiqués.
- Import des fichiers d'export `.ini` du jeu.
- Bibliothèque, plan d'élevage, arbre généalogique, compteurs de mutations.
- Aperçu 3D coloré des créatures (V1).
- Pages publiques par espèce et page « Join us » des serveurs du chef de projet (V1).

### OUT — ce qu'on ne fera pas

- **Paiement, abonnement premium** — raison : décision du chef de projet, le site reste
  gratuit pour tous.
- **Publicité, traceurs publicitaires** — raison : découle de RSE-03 (0 traceur) validée au
  cadrage, et le site ne vise aucun revenu.
- **Statut des serveurs en direct (joueurs connectés)** — raison : le chef de projet a
  retenu une page serveurs statique ; le direct demande une intégration aux serveurs sans
  servir l'objectif n°1.

### LATER — utile, pas maintenant

- Application native iOS / Android (décision du chef de projet : « pour plus tard »).
- Support d'ARK Survival Evolved (ASE).
- Interface multilingue FR / EN.
- Lecture de captures d'écran (OCR), intégration du mod « ARK Smart Breeding Export Gun »,
  espèces moddées (décision D-10).
- ⚠️ À VALIDER — import d'une bibliothèque ASB existante (`.asb`).

### Recommandations

| # | Constat | Recommandation | Bénéfice → objectif servi |
| --- | --- | --- | --- |
| 1 | Le fichier d'export n'existe que sur le PC du joueur ; sur console, il n'y a que les valeurs affichées | Trois voies d'ajout : glisser-déposer des `.ini`, surveillance du dossier (Chrome, Edge), saisie manuelle des valeurs ; la bibliothèque est synchronisée sur le compte, donc lisible sur mobile | Ajout d'une créature en 30 s sur tout support → O-01 |
| 2 | ASB publie sous licence MIT ses valeurs de stats par espèce, tenues à jour à chaque patch | Importer ces valeurs plutôt que les ressaisir, avec attribution, et valider l'extracteur sur 50 exports de référence | Résultats identiques à ASB dès le MVP → O-01, confiance des joueurs |
| 3 | Une application monopage se référence mal ; les recherches portent sur les espèces | Pré-rendre une page publique par espèce ASA (stats de base, temps d'élevage), avec sitemap | Pages d'entrée indexables → O-02 |
| 4 | Les tribus ARK s'organisent sur Discord | Connexion Discord au MVP, invitation de tribu par lien partageable dans Discord | Moins de friction à l'inscription → O-03, O-04 |

## §5 · Exigences fonctionnelles

| ID | Exigence | Priorité | Critère d'acceptation | Source |
| --- | --- | --- | --- | --- |
| EF-01 | Se connecter avec son compte Discord | Must | Given un visiteur sans compte, When il clique sur « Se connecter avec Discord » puis autorise l'application, Then son compte est créé et il arrive sur sa bibliothèque en 3 clics maximum | Dylan, cadrage du 12/10/2026 |
| EF-02 | Créer un compte avec un email | Should | Given un visiteur sans compte, When il saisit un email valide avec un mot de passe de 12 caractères minimum, Then il reçoit un mail de validation en moins de 2 minutes, And son compte devient actif au clic sur le lien | Dylan, cadrage du 12/10/2026 (D-06) |
| EF-03 | Créer une tribu | Must | Given un joueur connecté, When il crée une tribu en saisissant un nom de 3 à 40 caractères, Then la tribu est créée, And il en devient l'unique propriétaire | Dylan, cadrage du 12/10/2026 |
| EF-04 | Inviter un joueur dans sa tribu par lien | Must | Given un membre d'une tribu, When il copie le lien d'invitation, Then un joueur connecté qui ouvre ce lien rejoint la tribu, And le lien expire 7 jours après sa création | Dylan, cadrage du 12/10/2026 |
| EF-05 | Déclarer les multiplicateurs de stats de son serveur | Must | Given une tribu, When un membre choisit le préréglage « Officiel » ou saisit les multiplicateurs de son serveur, Then les extractions suivantes de la tribu utilisent ces valeurs, vérifié sur 5 créatures d'un serveur non officiel | Claude, proposition validée par Dylan le 12/10/2026 |
| EF-06 | Importer des fichiers d'export `.ini` par glisser-déposer | Must | Given 20 fichiers d'export ASA, When le joueur les dépose sur la page bibliothèque, Then les 20 créatures apparaissent en 5 s maximum avec nom, sexe, points, couleurs | Dylan, cadrage du 12/10/2026 |
| EF-07 | Retrouver le dossier d'export du jeu sans le chercher | Should | Given un joueur sur ordinateur, When il copie le chemin DinoExports affiché puis le colle dans le sélecteur de fichiers, Then ses exports s'affichent, And le sélecteur rouvre ce dossier aux imports suivants | Dylan, cadrage du 12/10/2026 (D-06, D-20, D-22) |
| EF-08 | Ajouter une créature depuis les valeurs affichées en jeu | Must | Given un joueur qui saisit l'espèce, le niveau, les valeurs de stats affichées en jeu, When il valide, Then les points sauvages et domestiqués de chaque stat s'affichent en 1 s maximum, And la saisie complète dure 30 s maximum (test chronométré sur 5 joueurs) | Dylan, cadrage du 12/10/2026 |
| EF-09 | Choisir parmi plusieurs résultats d'extraction possibles | Should | Given des valeurs compatibles avec plusieurs répartitions de points, When l'extraction se termine, Then toutes les répartitions possibles sont listées, And le joueur en retient une en 1 clic | Claude, proposition validée par Dylan le 12/10/2026 |
| EF-10 | Filtrer la bibliothèque par espèce, sexe ou statut | Must | Given une bibliothèque de 1 000 créatures, When le joueur applique un filtre, Then la liste filtrée s'affiche en 1 s maximum | Dylan, cadrage du 12/10/2026 |
| EF-11 | Repérer la meilleure valeur de chaque stat dans une lignée | Must | Given une lignée d'au moins 10 créatures, When le joueur ouvre la lignée, Then la meilleure valeur de chaque stat est surlignée, And la créature qui la porte est nommée | Dylan, cadrage du 12/10/2026 |
| EF-12 | Obtenir les 5 meilleurs couples d'une lignée | Must | Given une lignée d'au moins 2 mâles et 2 femelles, When le joueur ouvre le plan d'élevage, Then 5 couples au maximum s'affichent classés par score décroissant, And chaque couple indique les stats maximales qu'il peut transmettre | Dylan, cadrage du 12/10/2026 |
| EF-13 | Connaître la probabilité d'un bébé portant toutes les meilleures stats du couple | Should | Given un couple proposé, When le joueur l'ouvre, Then la probabilité s'affiche en pourcentage à 0,1 % près | Claude, proposition validée par Dylan le 12/10/2026 |
| EF-14 | Afficher l'arbre généalogique d'une créature | Must | Given une créature dont les ancêtres sont dans la bibliothèque, When le joueur ouvre son arbre, Then 5 générations s'affichent | Dylan, cadrage du 12/10/2026 |
| EF-15 | Afficher les compteurs de mutations d'une créature | Must | Given une créature importée, When le joueur ouvre sa fiche, Then les mutations côté mère puis côté père s'affichent séparément, And une alerte apparaît dès qu'un compteur atteint 20 | Dylan, cadrage du 12/10/2026 |
| EF-16 | Relier automatiquement une créature importée à ses parents | Should | Given un export dont les 2 parents sont déjà dans la bibliothèque, When il est importé, Then les 2 parents sont reliés sans saisie | Claude, proposition validée par Dylan le 12/10/2026 |
| EF-17 | Partager la bibliothèque de la tribu entre ses membres | Must | Given deux membres A, B d'une même tribu, When A ajoute une créature, Then B la voit au chargement suivant de la bibliothèque | Dylan, cadrage du 12/10/2026 |
| EF-18 | Consulter la fiche publique d'une espèce sans compte | Should | Given un visiteur non connecté, When il ouvre la fiche d'une espèce ASA, Then il voit ses stats de base, son temps d'incubation, son temps de maturation | Dylan, cadrage du 12/10/2026 (objectif O-02) |
| EF-19 | Consulter la page des serveurs de la communauté | Should | Given un visiteur, When il ouvre la page « Join us », Then il voit la liste des serveurs, And un lien vers le Discord des serveurs | Dylan, cadrage du 12/10/2026 |
| EF-20 | Supprimer son compte | Must | Given un joueur connecté, When il confirme la suppression de son compte, Then il ne peut plus se connecter, And ses données personnelles sont effacées sous 30 jours (requête de contrôle en base) | Dylan, cadrage du 12/10/2026 (RGPD) |
| EF-21 | Exporter ses données au format JSON | Could | Given un joueur connecté, When il demande l'export, Then il télécharge un fichier JSON contenant 100 % de ses créatures | Claude, proposition validée par Dylan le 12/10/2026 |
| EF-22 | Visualiser une créature en 3D avec ses couleurs | Should | Given une créature avec ses 6 régions de couleur, When le joueur ouvre l'aperçu 3D, Then le modèle s'affiche avec les 6 couleurs de l'export en 5 s maximum en 4G, And le modèle n'est téléchargé qu'à l'ouverture de l'aperçu | Dylan, cadrage du 12/10/2026 (D-05, D-06) |
| EF-23 | Exclure un membre de la tribu | Must | Given le propriétaire d'une tribu, When il exclut un membre, Then ce membre perd l'accès à la bibliothèque de la tribu dès sa requête suivante | Dylan, cadrage du 12/10/2026 (D-04) |
| EF-24 | Transférer la propriété de la tribu | Must | Given le propriétaire d'une tribu, When il désigne un autre membre comme propriétaire, Then ce membre devient propriétaire, And l'ancien propriétaire redevient membre | Dylan, cadrage du 12/10/2026 (D-04) |
| EF-25 | Régénérer le lien d'invitation de la tribu | Must | Given le propriétaire d'une tribu, When il régénère le lien, Then l'ancien lien est refusé, And un nouveau lien valable 7 jours est créé | Dylan, cadrage du 12/10/2026 (D-04) |
| EF-26 | Supprimer la tribu | Must | Given le propriétaire d'une tribu, When il confirme la suppression en saisissant le nom de la tribu, Then la tribu avec sa bibliothèque est supprimée, And chaque membre en est informé à sa connexion suivante | Dylan, cadrage du 12/10/2026 (D-04) |
| EF-27 | Choisir les réglages d'un serveur partagé | Should | Given un serveur publié par un autre joueur, When un membre le choisit pour sa tribu, Then les extractions de la tribu utilisent ses réglages, And une modification du serveur s'applique à la tribu sans nouvelle saisie | Dylan, demande du 13/10/2026 (D-17) |
| EF-28 | Publier les réglages de son serveur | Should | Given un joueur qui a saisi des réglages personnalisés, When il les publie sous un nom de 3 à 60 caractères, Then le serveur apparaît dans la liste des serveurs partagés, And seul ce joueur peut le modifier ou le retirer | Dylan, demande du 13/10/2026 (D-17) |

## §6 · Exigences non fonctionnelles

| ID | Exigence | Priorité | Critère d'acceptation | Source |
| --- | --- | --- | --- | --- |
| ENF-01 | Performance : temps d'affichage des pages | Must | LCP ≤ 2,5 s au 75e percentile en 4G (Lighthouse) ; temps de réponse de l'API ≤ 300 ms au 95e percentile (Cloudflare Analytics) | Claude, proposition validée par Dylan le 12/10/2026 |
| ENF-02 | Sécurité : protection des comptes | Must | Mots de passe hachés en PBKDF2-SHA256 avec au moins 100 000 itérations ; cookies de session HttpOnly, Secure, SameSite=Lax ; 0 accès aux données d'une autre tribu sur 20 tests d'isolement | Claude, proposition validée par Dylan le 12/10/2026 |
| ENF-03 | Compatibilité : navigateurs, écrans | Must | 2 dernières versions de Chrome, Edge, Firefox, Safari ; écrans de 360 px à 2 560 px de large sans défilement horizontal | Dylan, cadrage du 12/10/2026 (mobile + desktop) |
| ENF-04 | Intégration : données d'espèces issues d'ASB | Must | 100 % des espèces ASA domesticables du fichier de valeurs d'ASB importées ; mise à jour au plus 7 jours après une nouvelle version d'ASB ; licence MIT jointe aux données, consultable sur la page « Mentions légales et crédits » | Claude, proposition validée par Dylan le 12/10/2026 |
| ENF-05 | Référencement des pages publiques | Should | Pages espèces pré-rendues côté serveur ; sitemap.xml publié ; score SEO Lighthouse ≥ 95 sur 5 fiches espèces | Dylan, cadrage du 12/10/2026 (objectif O-02) |
| ENF-06 | Hébergement dans l'offre gratuite Cloudflare | Must | Consommation ≤ 80 % des quotas gratuits (Workers : 100 000 requêtes par jour ; D1 : lectures, écritures, 5 Go) ; alerte automatique au-delà | Dylan, cadrage du 12/10/2026 (budget) |
| ENF-07 | Exactitude de l'extraction | Must | Sur 50 fichiers d'export de référence, 100 % des points extraits identiques à ceux calculés par ASB | Claude, proposition validée par Dylan le 12/10/2026 |

## §7 · Exigences RSE

| ID | Exigence | Priorité | Critère d'acceptation (seuil) | Vérification | Source |
| --- | --- | --- | --- | --- | --- |
| RSE-01 | Chaque page pèse 1 Mo maximum hors aperçu 3D | Must | Poids ≤ 1 Mo, EcoIndex ≥ B sur 5 pages clés (accueil, bibliothèque, saisie, plan d'élevage, fiche espèce) | Audit EcoIndex / Lighthouse | Claude, proposition validée par Dylan le 12/10/2026 |
| RSE-02 | Les parcours clés sont accessibles | Must | Parcours « ajouter une créature » et « plan d'élevage » 100 % conformes WCAG 2.1 AA ; contraste ≥ 4,5:1 | Audit RGAA | Dylan, cadrage du 12/10/2026 |
| RSE-03 | Aucun traceur | Must | 0 cookie publicitaire ou de mesure d'audience ; mesure d'audience sans cookie | Scan des cookies | Claude, proposition validée par Dylan le 12/10/2026 |
| RSE-04 | Les comptes inactifs sont supprimés | Should | Comptes sans connexion depuis 3 ans supprimés automatiquement | Registre RGPD, requête de contrôle en base | Dylan, cadrage du 12/10/2026 (RGPD) |

## §8 · Contraintes

| Famille | Contrainte | Origine | Conséquence sur le projet |
| --- | --- | --- | --- |
| Budget | Aucun budget hors nom de domaine (≈ 10 à 15 € par an) | Dylan, cadrage | Offres gratuites uniquement : Cloudflare, Discord, service de mails gratuit |
| Délais | Aucune date ferme | Dylan, cadrage | Planning par jalons, sans dates ; risque d'étalement (R-02) |
| Techniques | Hébergement du front comme du back sur Cloudflare | Dylan, cadrage | Back exécuté sur Workers (pas de Node.js complet), base D1 (SQLite) |
| Techniques | ARK Survival Ascended uniquement pour le MVP | Dylan, cadrage | Données de stats ASA seulement ; ASE en LATER |
| Techniques | Données de l'export du jeu disponibles uniquement sur PC | Jeu ARK | Saisie manuelle obligatoire pour console ; mobile en consultation |
| Organisationnelles | Un seul développeur | Dylan, cadrage | Charge portée par une seule personne (R-02) |
| Langue | Interface en français au MVP | Dylan, cadrage | Les requêtes anglaises (« ark breeding ») sont moins bien servies (R-04) |
| Légales | RGPD : comptes joueurs avec email | Loi | Mentions légales, politique de confidentialité, suppression du compte (EF-20) |
| Légales | Accessibilité WCAG 2.1 AA | Dylan, cadrage | RSE-02 |
| Légales | Mention « site non officiel », pas de logo ARK | Studio Wildcard (marque) | Bandeau en pied de page ; nom du site sans « Smart Breeding » (R-08) |
| Légales | Licence MIT des données d'ASB | Dépôt cadon/ARKStatsExtractor | Licence jointe aux données, consultable dans les mentions légales (ENF-04) |

## §9 · Faisabilité

### Estimation de charge

Charge par lot, en jours, pour un développeur seul :

| Lot | Exigences | Charge (j) |
| --- | --- | --- |
| Cadrage & conception (CDC, maquettes, modèle de données) | — | 3 |
| Socle Cloudflare (Pages, Workers, D1, intégration continue) | — | 2 |
| Comptes & sécurité | EF-01, EF-02, EF-20, EF-21, ENF-02 | 7 |
| Tribus | EF-03, EF-04, EF-17, EF-23 à EF-26 | 4 |
| Données d'espèces & multiplicateurs | EF-05, ENF-04 | 3 |
| Extracteur (PERT) | EF-08, EF-09, ENF-07 | 7,5 |
| Import `.ini` (PERT) | EF-06, EF-07, EF-16 | 3,5 |
| Bibliothèque & plan d'élevage | EF-10 à EF-13 | 7 |
| Généalogie & mutations | EF-14, EF-15 | 2,5 |
| Aperçu 3D (PERT) | EF-22 | 7 |
| Pages publiques & référencement | EF-18, EF-19, ENF-05 | 4,5 |
| Qualité transverse (perf, compatibilité, quotas, RSE) | ENF-01, ENF-03, ENF-06, RSE-01 à RSE-04 | 4,5 |
| Recette (50 exports de référence, audits) | — | 2,5 |
| Déploiement (domaine, production) | — | 1 |
| Gestion de projet (15 %) | — | 8,85 |
| **Total** | | **67,85** |

PERT sur les trois lots les plus incertains, `E = (O + 4M + P) / 6`, `σ = (P − O) / 6` :

| Lot | O | M | P | E = (O+4M+P)/6 | σ = (P−O)/6 |
| --- | --- | --- | --- | --- | --- |
| Extracteur (adapter l'algorithme d'ASB) | 4 | 7 | 12 | 7,33 | 1,33 |
| Aperçu 3D coloré | 3 | 6 | 15 | 7 | 2 |
| Import `.ini` + surveillance du dossier | 2 | 3 | 6 | 3,33 | 0,67 |
| **Total** | | | | **17,67** | **2,49** |

Engagement sur ces trois lots : E + σ = 20,2 jours. MVP seul (Must + lots transverses +
15 %) : ≈ 45 jours.

Le chef de projet juge l'estimation trop haute, mais le délai n'est pas un enjeu du projet
(décision D-11) : l'estimation sert à comparer les lots entre eux, pas à fixer des dates.

### Build / Buy / Low-code

| | Build (site sur Cloudflare) | Buy : ASB, outil existant | Low-code : Google Sheets + bot Discord |
| --- | --- | --- | --- |
| Coût initial | ≈ 68 jours de travail personnel | 0 € (gratuit, MIT) | 0 € |
| Coût récurrent | ≈ 1 € par mois (domaine) | 0 € | 0 € |
| Adéquation au besoin | Totale : multi-support, tribu, extracteur | Partielle : Windows uniquement, aucun partage | Faible : aucun extracteur |
| Dépendance | Au développeur | Au mainteneur d'ASB | À Google, à Discord |
| Réversibilité | Totale | — | Faible |

**Choix retenu : build.** ASB ne sert pas l'objectif n°1 hors Windows, et un tableur ne
calcule pas les points. Le build réutilise ce qu'ASB a de meilleur, ses données (licence
MIT), pour ne développer que l'expérience multi-support, la tribu et l'extracteur web.

### SWOT

| | Positif | Négatif |
| --- | --- | --- |
| **Interne** | **Forces** — Dylan joue à ASA et gère des serveurs : il connaît l'élevage de l'intérieur ; il maîtrise React, Node.js ; les données d'ASB sont réutilisables (MIT) ; coût quasi nul | **Faiblesses** — un seul développeur ; aucune date ferme ; première mise en production sur Cloudflare Workers, D1 ; algorithme d'extraction exigeant |
| **Externe** | **Opportunités** — ASB est réservé à Windows et ne partage rien ; les joueurs console ou mobile ne sont pas servis ; la communauté des serveurs de Dylan fournit des testeurs ; ASA continue de recevoir du contenu | **Menaces** — un patch ASA peut changer les formules ou le format d'export ; ASB et Dododex occupent déjà les recherches ; droits de Studio Wildcard sur les modèles 3D ; dépendance au rythme de mise à jour d'ASB |

### Grille de faisabilité

| Dimension | Statut | Justification |
| --- | --- | --- |
| Technique | Sous réserve | L'extracteur doit retrouver 100 % des points d'ASB sur 50 exports (ENF-07) ; à prouver au jalon J2 |
| Légale | Sous réserve | Source de modèles 3D libres de droits non trouvée (R-03) ; mention non officielle à afficher |
| Sécurité | OK | Hachage, cookies HttpOnly, tests d'isolement entre tribus (ENF-02) |
| Accessibilité | Sous réserve | Arbre généalogique et 3D sont graphiques : prévoir une alternative en liste pour RSE-02 |
| Données | OK | Valeurs d'espèces ASB sous MIT, mises à jour à chaque patch |
| Financière | OK | Offre gratuite Cloudflare + domaine ≈ 12 € par an |
| Délais | OK | Aucune date imposée ; le MVP resserré (D-06) limite le risque d'étalement |

## §10 · Priorisation & roadmap

### MoSCoW

| Priorité | Exigences | Effort (j) | Part de l'effort |
| --- | --- | --- | --- |
| Must | EF-01, EF-03 à EF-06, EF-08, EF-10 à EF-12, EF-14, EF-15, EF-17, EF-20, EF-23 à EF-26, ENF-01 à ENF-04, ENF-06, ENF-07, RSE-01 à RSE-03 | 30,5 | 58 % |
| Should | EF-02, EF-07, EF-09, EF-13, EF-16, EF-18, EF-19, EF-22, EF-27, EF-28, ENF-05, RSE-04 | 21 | 40 % |
| Could | EF-21 | 1 | 2 % |
| Won't | Paiement, publicité, statut des serveurs en direct (voir §4 OUT) | hors chiffrage | — |

Effort hors lots transverses (cadrage, socle, recette, déploiement, gestion de projet).

### Justification des Must

| ID | Pourquoi c'est un Must |
| --- | --- |
| EF-01 | Sans compte, pas de bibliothèque synchronisée ni de tribu |
| EF-03, EF-04, EF-17 | Le partage de tribu est la différence principale avec ASB |
| EF-23 à EF-26 | Sans droits du propriétaire, un seul membre peut effacer des mois d'élevage (D-04) |
| EF-05 | Sans multiplicateurs, l'extraction est fausse sur les serveurs non officiels |
| EF-06 | L'import d'un export évite toute ressaisie sur PC → O-01 |
| EF-08 | Seule voie d'ajout pour la console → O-01 |
| EF-10, EF-11 | Sans tri ni repérage des meilleures stats, la bibliothèque est une liste brute |
| EF-12 | Le plan d'élevage répond directement au besoin réel |
| EF-14, EF-15 | Le suivi des mutations est demandé au cadrage, et la limite de 20 bloque un élevage |
| EF-20 | Obligation RGPD |
| ENF-01 à ENF-04, ENF-06, ENF-07 | Socle de qualité sans lequel les Must ne tiennent pas (perf, sécurité, supports, données, coût, exactitude) |
| RSE-01 à RSE-03 | Validées au cadrage ; coût d'ajout bas si décidées dès la conception |

### MVP

Le **MVP** est exactement l'ensemble des Must ci-dessus. Test : mis en production demain, un
joueur PC ajoute une créature par glisser-déposer, un joueur console par saisie, et la tribu
obtient ses 5 meilleurs couples. Il sert donc déjà l'objectif n°1 (O-01).

### Valeur / effort

| Lot | Valeur (1-5) | Objectif | Effort (j) | Quadrant |
| --- | --- | --- | --- | --- |
| Import `.ini` glisser-déposer | 5 | O-01 | 1,5 | Quick win |
| Plan d'élevage (5 couples) | 5 | O-01 | 2,5 | Quick win |
| Extracteur (saisie manuelle) | 5 | O-01 | 5 | Gros projet |
| Tribus | 4 | O-04 | 4 | Quick win |
| Pages espèces publiques | 4 | O-02 | 3 | Quick win |
| Surveillance du dossier | 3 | O-01 | 1,5 | Quick win |
| Aperçu 3D | 2 | aucun objectif chiffré | 7 | Piège à temps |
| Page « Join us » | 3 | O-05 | 0,5 | Quick win |

L'aperçu 3D tombe dans le quadrant « piège à temps » : sa valeur n'est reliée à aucun
objectif chiffré et son coût est élevé. Il reste en V1, conditionné à une source de modèles
libre de droits (R-03).

### Roadmap

- **MVP** — les Must : connexion Discord, tribus, multiplicateurs, extracteur, import par
  glisser-déposer, bibliothèque, plan d'élevage, arbre, mutations, suppression de compte.
- **V1** — les Should : email + mot de passe, surveillance du dossier, choix d'extraction
  ambiguë, probabilités, liaison des parents, pages espèces, page « Join us », aperçu 3D,
  suppression des comptes inactifs.
- **V2** — les Could et le LATER : export JSON, minuteurs, ASE, multilingue, application
  native.

## §11 · Livrables & planning

Aucune date ferme (décision D-03) : les jalons s'enchaînent dans l'ordre, le plus risqué
d'abord.

| Livrable | Format | Jalon | Date | Critère d'acceptation |
| --- | --- | --- | --- | --- |
| Cahier des charges v1.0 | `CAHIER-DES-CHARGES.md` | J0 | À la validation de Dylan | Statut « Validé par le chef d'équipe » |
| Socle déployé + connexion Discord | Front sur Pages, API sur Workers, base D1 | J1 | Sans date ferme | EF-01 passe en production |
| Extracteur + 50 exports de référence | Module + jeu de tests | J2 | Sans date ferme | ENF-07 à 100 % |
| Import `.ini` + bibliothèque | Pages bibliothèque, saisie | J3 | Sans date ferme | EF-06, EF-08, EF-10, EF-11 validées |
| Tribus | Gestion de tribu | J4 | Sans date ferme | EF-03, EF-04, EF-17, EF-23 à EF-26 validées |
| Plan d'élevage + généalogie | Pages plan, arbre | J5 | Sans date ferme | EF-12, EF-14, EF-15 validées |
| Recette + mise en ligne du MVP | Site en production sur domaine | J6 | Sans date ferme | Audits RSE-01, RSE-02, RSE-03 passés ; 5 joueurs testeurs |
| V1 | Site en production | J7 | Sans date ferme | Should du §10 validées |

## §12 · Budget

Projet personnel : la construction se compte en jours de travail bénévole, le coût réel ne
porte que sur le fonctionnement.

### Construire — une fois

| Poste | Charge (j) | TJM | Coût |
| --- | --- | --- | --- |
| Développement (lots du §9, hors gestion de projet) | 59 | 0 € (bénévole) | 0 € |
| Gestion de projet (15 %) | 8,85 | 0 € | 0 € |
| **Total** | **67,85** | | **0 €** |

### Faire tourner — par mois

| Poste | Coût mensuel |
| --- | --- |
| Cloudflare Pages, Workers, D1 (offre gratuite) | 0 € |
| Connexion Discord (OAuth) | 0 € |
| Service d'envoi de mails (offre gratuite, V1) | 0 € |
| Nom de domaine (≈ 12 € par an) ⚠️ prix exact selon l'extension choisie | ≈ 1 € |
| Maintenance | temps bénévole |
| **Total** | **≈ 1 €** |

### TCO 3 ans

`TCO = 0 € + 36 × 1 € = 36 €`.

Scénario de repli R-07 (dépassement des quotas, passage à Workers Paid à 5 $ par mois, soit
≈ 4,60 €) : `TCO = 0 € + 36 × 5,60 € ≈ 202 €`.

Option buy écartée (ASB) : TCO = 0 €, mais elle ne sert pas l'objectif n°1.

**Conclusion : tenable** dans la contrainte « gratuit + domaine » ; tenable sous condition
d'accepter ≈ 5 $ par mois si le trafic dépasse l'offre gratuite.

## §13 · Risques

| ID | Risque | P | I | Criticité | Niveau | Stratégie | Mesure préventive | Plan de repli | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | L'extracteur donne de faux résultats après un patch ASA | 3 | 4 | 12 | Critique | Réduire | Réutiliser les valeurs d'ASB ; jeu de 50 exports de référence rejoué à chaque mise à jour | Saisie directe des points par le joueur, bandeau d'avertissement | Dylan |
| R-02 | Le projet est abandonné (seul développeur, démotivation) | 3 | 4 | 12 | Critique | Réduire | MVP resserré ; jalons courts mis en ligne un par un | Passer le dépôt en open source pour qu'il soit repris | Dylan |
| R-03 | Les modèles 3D posent un problème de droits (Studio Wildcard) | 3 | 3 | 9 | Élevé | Éviter | Chercher des modèles sous licence libre ou commandés ; demander l'autorisation avant toute mise en ligne | Image 2D coloriée par région | Dylan |
| R-04 | Le référencement ne décolle pas : concurrence d'ASB et Dododex, MVP en français | 4 | 2 | 8 | Élevé | Réduire | Pages espèces pré-rendues, version anglaise en V1 | Viser des requêtes françaises (« élevage ark ») | Dylan |
| R-05 | Fuite de données ou compte piraté | 2 | 4 | 8 | Élevé | Réduire | Hachage, limitation du nombre de requêtes, tests d'isolement entre tribus | Invalider toutes les sessions, notifier la CNIL sous 72 h | Dylan |
| R-06 | Le format du fichier `.ini` change après un patch | 2 | 3 | 6 | Modéré | Réduire | Lecture tolérante des champs, tests sur exports récents | Message d'erreur explicite, saisie manuelle | Dylan |
| R-07 | Les quotas gratuits de Cloudflare sont dépassés | 2 | 3 | 6 | Modéré | Accepter | Alerte à 80 % des quotas (ENF-06) | Passage à Workers Paid (5 $ par mois) | Dylan |
| R-08 | Confusion avec la marque Smart Breeding ou ARK, demande de retrait | 2 | 3 | 6 | Modéré | Éviter | Nom sans « Smart Breeding », mention non officielle, attribution MIT | Renommer le site | Dylan |
| R-09 | Les données d'ASB tardent sur une nouvelle espèce ASA | 3 | 2 | 6 | Modéré | Accepter | Import automatique hebdomadaire des valeurs d'ASB | Saisie manuelle des valeurs de base de l'espèce | Dylan |
| R-10 | Faux comptes ou spam d'invitations | 2 | 2 | 4 | Modéré | Réduire | Cloudflare Turnstile ; liens d'invitation limités à 7 jours | Purge des comptes, bannissement | Dylan |
| R-11 | L'API Discord devient indisponible ou change | 1 | 3 | 3 | Faible | Accepter | Suivi du changelog de l'API Discord | Connexion par email (EF-02, V1) | Dylan |

## §14 · Validation

### Revue

- **Date** : 12/10/2026.
- **Participants** : Dylan (chef de projet, seul décideur) ; Claude (rédaction).
- **Ordre du jour** : besoin réel, MVP, OUT, 3 risques critiques, points ouverts.

### Décision

**GO** — le développement du MVP démarre (jalon J1). Les points de l'annexe B ne bloquent
pas le MVP.

### Relevé de décisions

| ID | Décision | Motif | Impact | Porteur | Échéance | Version |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | ARK Survival Ascended seul au MVP, ASE en V2 | Version actuelle du jeu | Une seule table de valeurs à maintenir | Dylan | 12/10/2026 | v0.1 |
| D-02 | Comptes joueurs avec tribus partagées | Le partage est absent d'ASB | Back avec base de données, RGPD | Dylan | 12/10/2026 | v0.1 |
| D-03 | Aucune date ferme | Projet personnel | Planning par jalons (§11) | Dylan | 12/10/2026 | v0.1 |
| D-04 | Le créateur est propriétaire de la tribu, avec transfert possible | Protéger la bibliothèque des actions irréversibles | EF-23 à EF-26 | Dylan | 12/10/2026 | v0.1 |
| D-05 | Aperçu 3D demandé au MVP, malgré les risques de droits et de poids | Souhait du chef de projet | EF-22, R-03 | Dylan | 12/10/2026 | v0.1 |
| D-06 | MVP resserré : 3D, email, surveillance du dossier, pages espèces passent en V1 | Must à 89 % de l'effort, au-delà de la règle des 60 % | Remplace D-05 pour la 3D ; Must à 60 % | Dylan | 12/10/2026 | v0.1 |
| D-07 | Estimation recalée après le lot Extracteur | Le chef juge l'estimation trop haute | §9, §12 mis à jour au jalon J2 | Dylan | Jalon J2 | v0.1 |
| D-08 | Interface en français au MVP, anglais en V1 | Communauté francophone | R-04 | Dylan | 12/10/2026 | v0.1 |
| D-09 | Nom provisoire « Ark-breeding » | Le nom définitif viendra plus tard | Nom du dépôt, du site en attendant | Dylan | 12/10/2026 | v1.0 |
| D-10 | OCR, Export Gun, espèces moddées en LATER | Utiles, pas nécessaires au MVP | §4 LATER | Dylan | 12/10/2026 | v1.0 |
| D-11 | Pas de recalage de l'estimation (remplace D-07) | Le délai n'est pas un enjeu du projet | §9 | Dylan | 12/10/2026 | v1.0 |
| D-12 | Validation du CDC v1.0, GO | Cadrage terminé | Démarrage du jalon J1 | Dylan | 12/10/2026 | v1.0 |
| D-13 | Attribution ASB dans les mentions légales, plus en pied de page ; seules les espèces domesticables sont importées | La licence MIT exige la licence jointe, pas un bandeau ; les espèces non domesticables ne servent pas à l'élevage | ENF-04, §8 | Dylan | 12/10/2026 | v1.1 |
| D-14 | Chaque joueur reçoit une tribu personnelle à sa première connexion ; sa bibliothèque y est rangée | La bibliothèque appartient toujours à une tribu (EF-17) : le partage du jalon J4 se fait sans migration des créatures | EF-03, EF-17 | Dylan | 12/10/2026 | v1.2 |
| D-15 | Un joueur peut appartenir à plusieurs tribus et passe de l'une à l'autre ; un membre peut quitter sa tribu ; le propriétaire peut la renommer ; les réglages serveur (EF-05) se saisissent ou se collent depuis Game.ini, et les niveaux de la bibliothèque sont recalculés à l'enregistrement | Besoins implicites des règles de tribu (D-04) ; Dylan gère des serveurs non officiels | EF-03, EF-05, EF-23, EF-24 | Dylan | 13/10/2026 | v1.3 |
| D-16 | À la suppression d'un compte (EF-20), chaque tribu dont il est propriétaire passe à son plus ancien autre membre, prévenu ; une tribu sans autre membre est supprimée avec sa bibliothèque. L'effacement est immédiat | Ne pas détruire la bibliothèque des autres membres ; RGPD | EF-20, EF-24 | Dylan | 13/10/2026 | v1.4 |
| D-17 | Ajout des serveurs partagés (EF-27, EF-28) : un joueur publie une fois les réglages de son serveur, les autres le choisissent par son nom. Les réglages ne sont pas récupérables automatiquement à partir du nom (ils ne sont que dans les fichiers du serveur) | Éviter que chaque joueur colle le Game.ini ; sert les serveurs de Dylan (O-05) | EF-05, EF-27, EF-28 | Dylan | 13/10/2026 | v1.5 |
| D-18 | EF-16 : quand le fichier d'export ne contient pas d'ascendance (DinoAncestorsCount=0, fréquent dans ASA), les parents sont déduits de la génétique : chaque stat du bébé vient de sa mère ou de son père, une mutation ajoute 2 niveaux et 1 au compteur du bon côté. Lien automatique si un seul couple correspond, sinon suggestions sur la fiche | Constaté sur un vrai export ASA de Dylan ; vérifié sur ses données (seul couple trouvé = celui qu'il avait choisi) | EF-16 | Dylan | 13/10/2026 | v1.6 |
| D-19 | EF-15 / EF-16 : les compteurs de mutations des exports ASA restent souvent à 0 même après une mutation. Ils ne servent plus à écarter un couple de parents, seulement à départager ; les compteurs affichés (bibliothèque, fiche, plan d'élevage) sont recalculés d'après les parents connus : total de la mère (ou du père) + ses nouvelles mutations, en gardant la valeur de l'export si elle est plus haute. La stat mutée et son côté sont signalés à l'import, dans la bibliothèque et sur la fiche | Retour de Dylan sur la V1 : un bébé muté n'était pas relié à ses parents et affichait 0 mutation | EF-15, EF-16, EF-12 | Dylan | 14/10/2026 | v1.7 |
| D-20 | EF-07 : un navigateur ne peut pas surveiller un dossier en continu ni ouvrir un chemin donné. Sur Chrome et Edge, le joueur connecte une fois son dossier DinoExports (mémorisé dans ce navigateur) puis importe les nouveaux exports en un clic ; ailleurs, choix des fichiers ou dépôt n'importe où sur la page de la bibliothèque. Chrome refuse les dossiers sous « Program Files » : le dépôt de fichiers reste alors la solution | Retour de Dylan : le sélecteur de fichiers n'ouvrait pas le bon dossier et le glisser-déposer était difficile | EF-06, EF-07 | Dylan | 14/10/2026 | v1.7 |
| D-21 | La bibliothèque liste toutes les espèces qui se reproduisent, même sans créature (rubriques « Dans ta bibliothèque » et « Autres espèces » dans le filtre), avec un lien d'ajout. Le plan d'élevage affiche le niveau du bébé qui hérite de toutes les meilleures stats du couple, et la fourchette selon l'héritage | Retours de Dylan sur la V1 | EF-10, EF-12, EF-13 | Dylan | 14/10/2026 | v1.7 |
| D-22 | Le bouton « Connecter mon dossier DinoExports » (D-20) est retiré : Chrome refuse tout dossier sous « Program Files », où Steam installe ARK par défaut, et un site ne peut pas savoir où le jeu est installé. L'import se fait par dépôt sur la page ou par « Choisir des fichiers », avec le chemin Steam par défaut à copier ; le sélecteur retient ensuite le dossier | Constaté par Dylan sur son installation Steam : le bouton échouait | EF-07 | Dylan | 14/10/2026 | v1.8 |
| D-23 | La liste des espèces de la bibliothèque (D-21) ne garde que les créatures qu'un joueur peut posséder, sur les cartes déjà sorties sur ASA au 14/10/2026 : The Island, Scorched Earth, The Center, Aberration, Extinction, Ragnarok, Astraeos, Valguero, Lost Colony, Genesis 1. Retirés : créatures d'événement ou non apprivoisables (Polar Bear, Polar Purlovia, Maeguana, Party Dodo, Bunny Dodo, Bunny Oviraptor, Yeti, Nameless, Gigadesmodus) et le Tek Giganotosaurus, un Giganotosaurus normal en jeu. Ajoutés : les créatures propres à une carte DLC (Lightning et Poison Wyvern…) et les créatures premium (Fantastic Tames : Drakeling ×4, Elderclaw, Pyromane, Dreadmare… ; Armadoggo, Cosmo, Veilwyn), que les données d'ASB étiquettent comme variantes. Liste à revoir à chaque nouvelle carte | Retour de Dylan sur la liste des espèces | EF-10, ENF-04 | Dylan | 14/10/2026 | v1.9 |
| D-24 | EF-15 : chaque stat mutée affiche « M×n », n étant le nombre de mutations qu'elle porte, empilées sur les générations : le bébé reprend celles du parent dont il tient la stat et ajoute les siennes (une mutation = +2 niveaux). Quand les deux parents ont la même valeur avec des nombres différents, le plus haut est affiché suivi de « ? ». Bibliothèque et fiche ; le détail (dont nouvelles, côté) au survol | Demande de Dylan : voir le nombre de mutations sur une stat | EF-15 | Dylan | 15/10/2026 | v1.10 |
| D-25 | Minuteurs d'incubation (ou de gestation), de maturation et d'accouplement, avancés du LATER à la demande de Dylan (« on fait toutes les features »). Partagés par la tribu (table timers), durées tirées des valeurs d'ASB et des multiplicateurs d'élevage du serveur de la tribu ; la maturation annonce le prochain câlin d'imprégnation. Fin signalée sur la page ouverte (message, notification du navigateur si le joueur l'autorise) : pas de notification push ni d'email | Demande de Dylan | §4 LATER, EF-05 | Dylan | 16/10/2026 | v1.11 |
| D-26 | Les fichiers d'export ASA ne contiennent ni niveaux mutés ni compteurs fiables, et un niveau muté donne le même bonus qu'un niveau sauvage : une mutation ne se repère qu'en comparant le bébé à ses parents, qui doivent être importés au moins une fois. Dès qu'elle est repérée, elle est enregistrée sur le bébé (niveaux mutés, compteurs) ; un nouvel import ou un recalcul la garde. Les parents morts ou inutiles peuvent alors être supprimés, aussi par lot (cases à cocher, « Supprimer les morts ») | Retour de Dylan : Theri 7 de Maxou muté en jeu, non vu par le site ni par ASB (parents absents) | EF-15, EF-16, EF-10 | Dylan | 20/10/2026 | v1.12 |
| D-27 | EF-22 : l'aperçu des couleurs montre le dessin de la créature dans ARK, colorié région par région comme dans ASB, avec le nuancier des 6 régions. Images de github.com/arkutils/species-images (MIT, rendus du jeu faits par la communauté, 546 espèces dont ASA). Pas de 3D : aucun modèle 3D d'ARK n'est disponible légalement (propriété de Studio Wildcard). Risque R-03 accepté comme pour ASB : crédit dans les mentions légales, retrait sur demande | Dylan : « je veux les design de ark » ; les silhouettes dessinées et la 3D libre (low-poly) ont été écartées | EF-22, R-03 | Dylan | 26/10/2026 | v1.13 |

### Points ouverts

Voir l'annexe B.

## Annexe A · Entretien

Entretien de cadrage du 12/10/2026. Chef de projet : Dylan. Animation, reformulation et
prise de notes : Claude.

| # | Thème | Question | Réponse / verbatim |
| --- | --- | --- | --- |
| 1 | Contexte | Quelle version d'ARK cible-t-on ? | « On commence par ASA et on pourra faire ASE plus tard en V2 » |
| 2 | Contexte | Quel nom pour le projet ? | « je sais pas encore, et je voudrais garder la ligne Ark et breeding » |
| 3 | Contexte | Pour qui est ce projet ? | Projet personnel public |
| 4 | Contexte | Qui fait partie de l'équipe ? | Seul (Dylan) |
| 5 | Contexte | Y a-t-il une date de fin ? | Pas de date ferme |
| 6 | Problème actuel | Quel problème le site doit-il faire disparaître ? | « trop d'infos pas super fluide d'utilisation, je voudrais que ça soit plus fluide plus dynamique » ; ASB trop complexe, Windows uniquement, pas de partage tribu, tableurs perdus |
| 7 | Existant | Comment les joueurs font-ils aujourd'hui ? | Smart Breeding, Dododex, Ark Breeder mobile |
| 8 | Utilisateurs | À quelle fréquence un éleveur s'en servirait-il ? | « quand il en aura besoin, que ça soit à chaque session de jeu ou par périodes » |
| 9 | Enjeux | Pourquoi maintenant ? | Envie personnelle, portfolio, ASB peu adapté à ASA |
| 10 | Attentes | Le besoin réel proposé est-il juste ? | Validé : « on rajoutera des choses plus tard selon les demandes des joueurs » |
| 11 | Attentes | À quoi verra-t-on que le projet a réussi ? | Top 2 SEO, saisie ≤ 30 s, 500 actifs, 50 tribus ; « que ça soit aussi un petit pub pour nos serveurs ark » |
| 12 | Attentes | Quel est l'objectif n°1 ? | « la fluidité d'usage », en s'appuyant sur « l'option en jeu export dino qui nous sort les stats et les points du dinos plus son nom et couleurs » |
| 13 | Utilisateurs | Sur quel support ? | Mobile + desktop |
| 14 | Attentes | Quels modes d'ajout de créature au MVP ? | Glisser-déposer `.ini`, surveillance du dossier, saisie manuelle ; « à voir autres options sur d'autres versions » |
| 15 | Attentes | Qu'est-ce qu'on ne fera pas ? | Paiement, premium ; « l'appli native sera pour plus tard » |
| 16 | Attentes | Qu'est-ce qui peut attendre une version suivante ? | Minuteurs, support ASE, multilingue |
| 17 | Attentes | Sous quelle forme le « Join us » ? | Une page serveurs dédiée |
| 18 | Contraintes | En quelle langue sort le MVP ? | Français |
| 19 | Budget | Quels coûts acceptes-tu ? | Gratuit + nom de domaine |
| 20 | Contraintes | Comment les joueurs se connectent-ils ? | Discord, email + mot de passe |
| 21 | Contraintes | Quelles obligations légales ? | RGPD, accessibilité WCAG AA, mention ARK / Studio Wildcard |
| 22 | Attentes | Les exigences proposées conviennent-elles ? | Validées ; « explique moi le admin » ; email au MVP ; « je compte mettre aussi le côté 3D du dino avec les couleurs » |
| 23 | Attentes | Quels droits dans la tribu ? | Propriétaire + transfert |
| 24 | Attentes | Quel aperçu visuel des couleurs ? | 3D au MVP |
| 25 | Budget, délais | Comment régler le dépassement des Must ? | MVP resserré |
| 26 | Délais | Combien de jours par semaine ? | « on se consacre pas une limite, on le fait » |
| 27 | Délais | L'estimation est-elle réaliste ? | Trop haute |
| 28 | Risques | Manque-t-il un risque ? | Risques validés |
| 29 | Clôture | Qu'est-ce que je ne t'ai pas demandé ? | « Rien, c'est bon » |
| 30 | Validation | Quel nom en attendant ? | « on commence avec Ark-breeding et on changera après » |
| 31 | Validation | Import `.asb`, OCR, Export Gun, espèces moddées : quand ? | « L'OCR, l'export Gun, les espèces moddées on le fera plus tard » |
| 32 | Validation | Recale-t-on l'estimation ? | « on s'en fout de l'estimation en terme de temps » |
| 33 | Validation | Le CDC est-il validé ? | « oui c'est bon on passe au développement » |

## Annexe B · Points à compléter

| Section | Point | Nature | Qui tranche | Échéance |
| --- | --- | --- | --- | --- |
| Frontmatter | Nom définitif du site (avec « ark » et « breeding », sans « Smart Breeding ») ; « Ark-breeding » en attendant (D-09) | à compléter | Dylan | Sans échéance |
| §2 | Durée actuelle de saisie d'une créature dans ASB | à vérifier | Dylan | Jalon J2 |
| §2 | Cible chiffrée de O-05 (clics vers le Discord des serveurs) | non dit | Dylan | Avant la V1 |
| §4 | Import `.asb` : LATER ou OUT ? | à compléter | Dylan | Avant la V1 |
| §10 | Source de modèles 3D libres de droits | à compléter | Dylan | Avant la V1 |
| §12 | Extension du domaine, prix exact | à compléter | Dylan | Jalon J6 |
| EF-19 | Liste des serveurs, lien Discord pour la page « Join us » | non dit | Dylan | Avant la V1 |
