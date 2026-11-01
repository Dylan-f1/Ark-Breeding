# Design

Doc design du site : concept, références, typo, palette, signature. Les décisions datées vont au
cahier des charges (§ Décisions) ; ce fichier dit ce qui est en place et ce qui est proposé.

## Où on en est (01/11/2026)

**Direction C appliquée au vrai site** (branche `feature/refonte-design`), page clé : la Bibliothèque.

- Thème global (`app/app.css`) : palette C en un seul thème sombre (`<html class="dark">`), jetons
  `clean` / `mut` / `gold` / `panel-2`, rayon 0,2 rem ; sélection, barres de défilement et
  placeholder aux couleurs de la palette ; contour des champs à 3:1.
- Police **Saira** hébergée (`public/fonts`, latin + latin étendu, 164 Ko, OFL), créditée dans les
  mentions légales.
- Boutons en contour : `default` = contour cyan, `outline` = contour discret.
- Coquille commune `components/layout/app-shell.tsx` (pages connectées et publiques) : onglets
  latéraux à partir de 1024 px, icônes seules de 768 à 1023 px, barre d'onglets en bas en dessous.
  Les pages publiques (pré-générées) demandent au navigateur si le joueur est connecté, puis
  affichent les mêmes onglets et le même menu de compte (`components/layout/account-menu.tsx`).
- Plusieurs serveurs (D-37) : le menu de compte affiche la tribu ouverte et son serveur (barre
  latérale à partir de 1024 px, barre du haut sur mobile) ; chaque tribu de la liste montre son
  serveur ; la création d'une tribu propose les serveurs partagés.
- Bibliothèque :
  - titre étroit, compteurs à partir de 768 px ;
  - espèces en panneaux à coins coupés, avec « Plus proche du parfait » en tête ;
  - tableau serré, case et nom fixés au défilement, nom en en-tête de ligne ;
  - étoile dorée avec score ;
  - case teintée, sauf quand la majorité de la lignée est à égalité ; pas de marque pour un dino
    seul ;
  - couleurs en colonne ;
  - plus de liste des espèces sans dino en bas de page (D-36) : filtre Espèce et « Ajouter à la main ».
- Les autres pages prennent le thème, la police et les boutons, sans refonte de leur mise en page
  (déclinaison à faire).
- Finition (validée par Dylan le 01/11/2026 sur ordinateur et téléphone) :
  - critique Impeccable traitée : import en bouton principal une fois la bibliothèque remplie
    (zone de dépôt complète seulement quand elle est vide), lien « Aller au contenu », en-têtes
    abrégés lus en entier par les lecteurs d'écran ;
  - break-ui : nom vide affiché « Sans nom », colonne du nom bornée (le nom passe à la ligne, les
    stats restent visibles sur téléphone), noms longs de la liste des meilleures coupés avec le nom
    complet au survol, serveur et tribu complets au survol ;
  - mobile-native : `viewport-fit=cover`, `theme-color`, pas de flash au toucher, contrôles sans
    délai ni sélection au appui long, barre de sélection et notifications au-dessus de la barre
    d'onglets ;
  - maquette `/refonte` retirée.

Avant ce passage :

Le site tourne sur le thème shadcn par défaut, polices système (RSE-01, RSE-03 : aucune requête
vers un tiers). Première refonte lancée : trois directions appliquées à la page Bibliothèque, avec
des variantes de composants à combiner. Maquette : `/refonte` (non liée au menu, branche
`feature/refonte-design`). **Dylan choisit** ; rien n'est retenu tant qu'il n'a pas tranché.

Pourquoi la Bibliothèque : c'est la page où on passe le plus de temps (tableaux de stats, meilleures
valeurs, mutations), et la plus dense. Si une direction tient là, elle tient partout.

## Choix de Dylan (01/11/2026, D-35)

Lien de la combinaison : `/refonte?d=c&carte=2&bouton=2&stat=1&repere=1&anim=1&densite=1&couleurs=3`

- Direction **C. Console de tribu**
- Cartes des espèces : **Panneau** (coins coupés, bandeau d'en-tête, filet cyan)
- Boutons : **Contour**
- Meilleures stats : **Case teintée** (la barre de niveau en plus a été essayée après la critique, Dylan garde la case seule)
- Le plus proche du parfait : **Étoile**
- Animations : **Aucune**
- Densité : **Serrée**
- Couleurs des dinos : **Colonne à part** (régions utilisées seulement, liseré pour les couleurs sombres)

## Critique Impeccable du 01/11/2026 et corrections (P1)

Note 20/40, rapport dans `.impeccable/critique/`. Corrigé dans la maquette :

- **Signal des meilleures** : aucune marque quand l'espèce n'a qu'un dino ; pas de fond teinté quand plus de la moitié de la lignée partage la valeur (chiffre vert seul).
- **Plus proche du parfait** : étoile dorée dessinée (plus de caractère ★) avec le score écrit (« 4/6 ») ; ligne « Plus proche du parfait : nom, 4/6 » dans l'en-tête de l'espèce ; ces dinos passent en tête de leur lignée.
- **Noms identiques** : le nom est l'en-tête de sa ligne, les cases à cocher annoncent sexe et niveau, la liste des meilleures dit « 11 dinos » sur une égalité et renvoie à la ligne quand il n'y en a qu'un.
- **Tablette et mobile** : case et nom fixés à gauche quand le tableau défile ; menu en icônes seules de 721 à 1024 px ; barre d onglets en bas sous 720 px ; compteurs retirés sur mobile ; champs à 16 px (pas de zoom sur iPhone).

Reste (P2, plus tard) : bandeau d'import en simple bouton, contour des champs à 3:1, placeholder à 4,5:1, cases de 24 px, lien d'évitement, légende du tableau.

## Le sujet

- **Qui** : joueurs d'ARK Survival Ascended en tribu, souvent sur un second écran pendant la partie.
- **Ce que la page doit faire** : voir d'un coup d'œil les meilleures stats de chaque lignée, avec
  et sans mutation, et quel dino est le plus proche du parfait.
- **Contraintes gardées** : vert = meilleure stat sans mutation, ambre = avec mutation (D-28) ;
  ★ / « Parfait » à côté du nom (D-31) ; M×n (EF-15) ; lisible en AA.

## Les trois directions proposées

### A. Carnet de terrain

- **Idée** : le carnet de l'éleveur, comme les notes d'explorateur du jeu.
- **Références** :
  - carnets Rite in the Rain (papier jaune tout-temps, grille imprimée, couverture verte) ;
  - les dossiers de créatures d'ARK (croquis à l'encre, annotations à la main) ;
  - carnets de naturalistes.
- **Palette** :
  - papier `#ECE3B5`, grille `#34452B` à 9 % ;
  - encre `#1E2B24`, couverture `#34452B` ;
  - crayon rouge `#A8302A` ;
  - vert `#2C6A33`, ambre `#8A5000`.
- **Typo** : Zilla Slab (titres, comme les en-têtes imprimés des carnets), Instrument Sans (texte et
  chiffres), Reenie Beanie (annotations au crayon, uniquement les repères).
- **Signature** : les meilleures stats entourées au crayon, le repère du meilleur dino écrit à la main.

### B. Registre d'élevage

- **Idée** : le stud-book, le registre généalogique des éleveurs de chevaux et de chiens.
- **Références** :
  - General Stud Book (Weatherbys) et certificats de pedigree ;
  - *Werner's Nomenclature of Colours* : planches de couleurs nommées, comme les couleurs d'ARK.
- **Palette** :
  - page `#F3F4F0`, encre marine `#17243A` ;
  - reliure bordeaux `#6B1E2A`, filets `#C7CCD2` ;
  - vert `#1D6847`, ambre `#975000`, or `#86651A`.
- **Typo** : Newsreader seule (tailles optiques, petites capitales pour les en-têtes de colonnes,
  chiffres alignés).
- **Signature** : la reliure sur le bord gauche, la table des espèces à points de conduite, les
  couleurs en pastilles nommées comme une planche.

### C. Console de tribu

- **Idée** : l'interface du jeu (inventaire et panneau de stats d'ASA, terminaux Tek).
- **Justification du fond sombre** : on l'utilise pendant la partie, souvent le soir.
- **Palette** : nuit `#0E1B23`, panneau `#142632`, texte `#D6E5EB`, cyan du jeu `#6CCFE0`, vert
  `#5BC88C`, ambre `#EFA43E`, or `#E7C267`. Le fond reprend le bleu-ardoise d'ASA, pas un noir néon.
- **Typo** : Saira seule, la largeur fait la hiérarchie (étroite pour les titres et repères, normale
  pour les données).
- **Signature** : barres de niveau sous les stats comme dans le jeu, coins coupés des panneaux,
  barre latérale en onglets.

## Variantes de composants (combinables avec chaque direction)

| Élément | 1 | 2 | 3 |
|---|---|---|---|
| Cartes des espèces | Sans cadre (filet) | Panneau | Fiche à onglet |
| Boutons | Plein | Contour | Étiquette (coin coupé) |
| Meilleures stats | Case teintée | Cerclée | Barre de niveau |
| Le plus proche du parfait | Étoile | Score (5/6) | Ruban sur la ligne |
| Animations | Aucune | Ouverture des espèces | Séquence d'entrée + tracé des repères |
| Couleurs des dinos | Pastilles | Bande | Colonne à part |
| Densité du tableau | Serrée | Aérée | |

Chaque direction a une combinaison conseillée (bouton dans le panneau de choix).

## Points ouverts

- Polices chargées depuis Google Fonts dans la maquette seulement ; Saira est hébergée sur le vrai site.
- A et B sont en clair, C en sombre. Le mode inverse de la direction retenue reste à dessiner.
- Icônes lucide sans retouche : à revoir avec la direction retenue.
