---
title: Limitations
description: Ce qui n'est pas supporte dans le moteur principal et les liaisons de visualiseur - a lire avant d'adopter la bibliotheque.
---

# Limitations

::: warning A lire avant d'adopter
`pptx-viewer` couvre une grande surface de la specification OpenXML, mais certaines choses sont approximees, en lecture seule, ou limitees par la plateforme du navigateur. Cette page liste uniquement ce que vous **ne pouvez pas** faire, ou seulement partiellement. Tout ce qui n'est pas liste ici se charge, s'edite, se rend et s'enregistre normalement; voir [Conformite OpenXML](/architecture/openxml-conformance) pour le manifeste de couverture formel.
:::

## Moteur principal (`pptx-viewer-core`)

- **Format binaire heritee `.ppt`** - S'importe correctement (y compris protege par le schema "RC4 CryptoAPI" via `load(buffer, { password })`), mais l'enregistrement ecrit toujours du `.pptx`, comme PowerPoint lui-meme. L'ancien schema d'obfuscation RC4/XOR d'Office 95 n'est pas supporte. Le format etant anterieur a DrawingML, il n'y a pas de schema de polices de theme (le convertisseur en synthetise un a partir de la premiere police trouvee) et les effets sans equivalent binaire sont degrades.
- **Objets OLE** - Le contenu est en lecture seule (image d'apercu, telechargeable ou ouvrable dans un nouvel onglet), car le navigateur ne peut pas executer l'application native proprietaire de l'objet. Le nom de l'objet (`p:oleObj/@name`) est editable, mais ce n'est qu'une etiquette de metadonnees : PowerPoint incruste la legende visible de l'icone directement dans l'image de l'icone, et cela n'est pas regenere ici.
- **Mise en page SmartArt** - Quand le fichier contient le dessin precompile de PowerPoint, cette mise en page exacte est utilisee. Sinon, un interpreteur DiagramML (les dix types `dgm:alg`, contraintes, regles) l'approxime. Les organigrammes correspondent a des fixtures COM authentiques (topologie, decalage des branches suspendues, comportement en eventail, choix ligne vs colonne); un regroupement `chMax` plus profond ne se produit pas dans les fichiers PowerPoint authentiques.
- **Coordonnees des elements** - Position et taille sont conservees en interne en EMU exacts et reproduites octet pour octet a l'enregistrement, y compris pour les groupes imbriques et apres deplacement/redimensionnement (verifie par COM sur de nombreux cas de rotation et de groupes). Deux cas d'edition combinee a des angles non droits restent seulement a 1 EMU pres (1/914400 pouce) de la reference COM, a cause de l'arrondi trigonometrique propre a PowerPoint aux angles irrationnels, pas d'une erreur de formule.
- **Taille d'archive** - Une protection anti zip-bomb limite par defaut a 500 Mio non compresses (ajustable via `maxUncompressedBytes`) et 65 536 entrees d'archive; depasser l'un ou l'autre leve `ZipBombError`.
- **Duree de transition** - `p14:dur` est ecrit dans l'espace de noms Office 2010 avec `mc:Ignorable`, car `CT_SlideTransition` n'a pas d'attribut `dur` natif; les lecteurs plus anciens que PowerPoint 2010 se rabattent sur la vitesse `spd`.

### Creation d'animations

Un effet cree dans le panneau d'animation est reconcilie dans l'arbre `p:timing` existant de la diapositive; les effets propres au fichier restent octet-identiques. Dans ce cadre :

- **Son d'effet (`p:stSnd`)** - Seuls "Aucun son" ou un fichier audio personnel sont proposes; les sons de la bibliotheque PowerPoint (Applaudissements, Appareil photo, Carillon, etc.) sont des ressources Microsoft absentes de ce depot.
- **`p:bldP/p:tmplLst`/`p:tmpl`** - Analyse de maniere typee et conserve a l'enregistrement, mais jamais utilise a la lecture : PowerPoint n'utilise ces modeles que pour initialiser un niveau de plan sans effet propre, et le niveau visible a deja son propre noeud dans `p:timing/p:tnLst`.
- **`p:animEffect/@filter` `image`** - 26 des 27 familles de filtres SMIL produisent un effet reel. `pixelate` est une mosaique construite avec des filtres SVG maison (la comparaison image par image via COM montre que PowerPoint 2016 n'anime rien pour ce filtre, il saute directement a l'etat final). `image` devrait substituer une seconde image creee separement que la charge OOXML ne contient jamais, il n'y a donc rien a substituer.

### Mise en forme des graphiques et ChartEx

- **`c:pictureOptions` sur les barres 3D** - Quand une face non ciblee n'a qu'un remplissage image, PowerPoint prend la couleur du pixel (0,0) de l'image et peint la face de cette couleur plate (verifie par COM); ce moteur de rendu recupere ce pixel de maniere asynchrone et repeint le graphique une fois pret. La scene three.js optionnelle peint des textures reelles par face aussi sur les barres cylindriques, coniques et pyramidales, pas seulement sur celles en forme de boite.
- **Extensions de graphiques Office (`c15:`/`c16:`/`c16r3:`)** - Une bonne partie est modelisee et survit a l'enregistrement : identite serie/point, lignes de rappel des camemberts, "afficher #N/A comme vide", etiquettes "valeur depuis les cellules" et series filtrees. Un filtre de categorie pur n'a besoin d'aucun modele car PowerPoint l'ecrit comme un cache raccourci sur chaque serie restante. `c15:filteredCategoryTitle`/`filteredSeriesTitle`, `c15:xForSave` et `c15:datalabelsRange`/`dlblRangeCache` restent en passthrough brut `extLst`, car PowerPoint 2016 n'a pas pu etre force a les ecrire via COM et aucun fichier du corpus ne les contient.

### Tableaux, geometrie et edition media

- **`onStopAudio` en export sans interface** - Le declencheur attend normalement l'evenement `ended` d'un veritable element `<audio>`/`<video>`. En l'absence d'un tel element (export headless, ou media non monte), un minuteur de duree estimee prend le relais, exactement ce que PowerPoint lui-meme ecrit pour son propre enchainement audio "Apres le precedent".

### Detecter les lacunes a l'execution

Le pipeline de chargement signale chaque construction non supportee ou approximee dans `data.warnings`, type `PptxCompatibilityWarning` (avec `code`, `severity`, `scope`, et optionnellement `slideId`/`elementId`/`xmlPath`). Verifiez `data.warnings` apres `load()` (et apres `save()`) si votre application doit afficher des avis de fidelite ou activer des fonctionnalites selon le fichier.

## Environnements d'execution

- **Navigateur** - Ensemble complet de fonctionnalites : analyse, rendu, edition, export, collaboration.
- **Node.js (et serverless)** - Coeur uniquement : `pptx-viewer-core` (chargement, edition, enregistrement, conversion Markdown/SVG, chiffrement) est independant du DOM. Les liaisons UI, l'export raster (`html2canvas`) et la conversion EMF/WMF sont des fonctionnalites de navigateur.
- **Web Worker** - Meme perimetre que Node.js : le moteur n'a aucune dependance au DOM.

## Visualiseurs de framework (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning Le rendu base sur CSS echange certains effets visuels contre de la fidelite ailleurs
Les diapositives sont rendues en HTML/CSS plutot qu'en Canvas, ce qui donne un texte net a n'importe quel zoom, une accessibilite native et une interactivite DOM. La contrepartie est que quelques effets PowerPoint n'ont pas d'equivalent CSS exact et sont approximes.
:::

### Approximations des effets visuels

- **Formes et scenes 3D (`a:sp3d`/`a:scene3d`)** - Les presets de camera `perspective*` et `isometric*` sont implementes comme une homographie `matrix3d` exacte mesuree par COM, pas une rotation approximative. `oblique*`/`legacyOblique*`/`legacyPerspective*`/`orthographicFront` laissent la face avant plate (confirme par COM; seuls les panneaux lateraux extrudes reagissent). Une surcharge explicite `a:camera/a:rot`/`@fov`/`@zoom` utilise toujours l'ancien modele base sur la rotation. La profondeur d'extrusion se rend en veritables panneaux lateraux `translateZ`; le cote visible a ete mesure par COM pour la plupart des presets, et plusieurs n'affichent aucun panneau, comme dans PowerPoint. Le biseau et les materiaux sont des couches CSS `box-shadow`/`filter`, pas une geometrie ou un eclairage reel; la direction du reflet est verifiee par COM pour la plupart des profils de biseau, sans signal clair pour deux d'entre eux. L'ombre du plan de sol (`a:backdrop`) n'est plus synthetisee, car un plan fortement incline projette une ombre non convexe qu'aucun `box-shadow` CSS ne peut representer. Le WordArt/texte sous `a:bodyPr/a:scene3d` reutilise la meme fonction de camera que les formes.
- **Reflets** - Un noeud jumeau miroir (respectant `@sx`/`@sy`/`@kx`/`@ky`/`@rot`/`@fadeDir`/`@algn`) qui reflete tout le contenu rendu : remplissage, contour et texte pour une forme/image, et recursivement chaque enfant pour un groupe. Un enfant ayant son propre reflet a l'interieur d'un groupe reflete est reflete deux fois, exactement comme PowerPoint compose le reflet d'un groupe a partir de son contenu deja rendu.
- **Bords doux (`a:softEdge`)** - Filtre SVG de degrade alpha (adoucit seulement le bord, pas tout l'element).
- **Degrades de chemin** - Types `circle`/`shape` : un radial elliptique. Type `rect` : des bandes rectangulaires imbriquees alignees sur les axes, pour reproduire le champ a coins carres de PowerPoint (aucun radial CSS/SVG natif n'a de coins carres).
- **Deformations de texte WordArt** - Chaque preset `a:prstTxWarp` se rend en veritable texte SVG. Arc/vague/cercle/anneau/bouton/incline/fondu/cascade suivent une ligne de base `textPath` courbee; `inflate`/`deflate`/`can` rendent chaque glyphe avec sa propre transformation affine ajustee a la courbe d'enveloppe, decoupee en jusqu'a 24 sous-bandes pour les legendes courtes afin de reduire l'erreur. Face a PowerPoint reel via COM, les mathematiques de la courbe correspondent avec une erreur moyenne d'environ 0.2%; les glyphes individuels restent dans une marge d'environ 1-2% pour des legendes ordinaires.
- **Transitions 3D cinematiques** - Animees par des keyframes CSS (perspective/rotation/enroulement) sur des calques 2D, pas un rendu volumetrique 3D reel. La plupart des presets sont verifies par COM (`CreateVideo`) contre PowerPoint 2016. `vortex`, `honeycomb`, `glitter`, `shred`, `fracture`, `curtains` et `airplane` se decomposent en de nombreux fragments ou particules independants dans PowerPoint reel, ce qu'un seul calque CSS ne peut pas reproduire litteralement; ils conservent un substitut a calque unique avec la bonne direction.

### Comportement lie a la plateforme

- **Polices** - Le texte utilise les polices disponibles dans le navigateur; les polices manquantes reviennent aux valeurs par defaut du systeme. Les polices integrees dans le PPTX sont injectees quand elles existent.
- **Codecs media** - La lecture audio/video depend du navigateur (WMV et les codecs anciens peuvent ne pas se lire); les medias proteges par DRM ne se lisent pas.
- **Transitions morph** - Les elements sont apparies par nommage `!!`, identite `a16:creationId`/id de forme natif, ou proximite de meme type. Un nom de volet de selection sans prefixe `!!` ne compte pas (confirme face a PowerPoint reel). Un element sans equivalent sur la diapositive suivante effectue un fondu enchaine plutot qu'un morph, exactement comme PowerPoint.
- **Export raster** - PNG/JPEG/PDF utilise `html2canvas`, qui ne peut pas reproduire `backdrop-filter`, les proprietes personnalisees CSS ou les transformations CSS 3D; utilisez l'export SVG comme alternative vectorielle.
- **Resolution d'export** - Les exports canvas sont plafonnes par la taille maximale de canvas du navigateur (typiquement 16 384 ou 32 768 pixels par cote).
- **Raccourcis de diaporama** - `F5`/`Shift+F5` sont mappes sur "A partir du debut"/"A partir de la diapositive actuelle" de PowerPoint des que le visualiseur a le focus et qu'aucun diaporama n'est en cours, donc un simple `F5` ne recharge plus la page; `Ctrl+F5` et le bouton d'actualisation du navigateur restent inchanges.
- **Edition restreinte** - Un fichier enregistre avec un mot de passe de modification (`p:modifyVerifier`) s'ouvre en lecture seule; "Modifier quand meme" verifie le mot de passe contre chaque algorithme de hachage autorise par ECMA-376. Un verificateur sans `saltData` ne peut pas etre verifie et se rabat sur un "Modifier quand meme" inconditionnel; l'automatisation COM a confirme que PowerPoint reel ecrit toujours un sel, ce cas ne provient donc pas de fichiers authentiques.
- **Verbes d'action OLE** - Un clic sur `ppaction://ole?verb=N` ouvre toujours le fichier integre, quel que soit le verbe, car le navigateur ne peut pas lancer l'application proprietaire reelle.
- **Actions d'execution de programme** - `ppaction://program` est analyse et conserve a l'enregistrement, mais un clic ne fait rien pendant un diaporama, car un navigateur ne peut pas lancer un executable local.
- **Petits ecrans** - L'interface s'adapte jusqu'aux telephones d'environ 360 px, mais les panneaux les plus denses en donnees (par exemple l'editeur de graphiques complet) sont mieux utilises sur une tablette ou plus grand.

## Metafichiers EMF/WMF (dependance `emf-converter`)

::: info Pas le code de ce depot
`emf-converter` est un paquet npm independant avec son propre depot; `pptx-viewer-core` ne fait que le consommer. Le tableau ci-dessous reflete ce que fait ce paquet aujourd'hui; en cas de divergence, ses propres notes de version font foi.
:::

::: warning API Canvas requise
La conversion de metafichiers necessite `OffscreenCanvas` ou `HTMLCanvasElement`. Node.js pur sans polyfill canvas n'est pas supporte pour les images EMF/WMF (le reste du moteur principal fonctionne bien dans Node).
:::

- **Pinceaux de degrade** - Les degrades lineaires et de chemin GDI+ sont rendus simplifies, avec leur couleur principale uniquement.
- **Operations raster** - Les modes de fusion ROP de GDI (XOR, NOT, AND, ...) sont ignores.
- **Ecretage** - Un seul chemin est supporte; les operations de region GDI combinees (union/intersection/exclusion) ne le sont pas.
- **Taille de sortie** - Limitee a 4096 x 4096 pixels.
- **Texte** - Utilise le moteur de polices du navigateur; les metriques de glyphes peuvent differer de GDI Windows.

## Lectures connexes

- [Introduction](/fr/guide/introduction) - ce que le projet supporte globalement.
- [Architecture](/fr/guide/architecture) - pourquoi ces compromis existent.
- [Conformite OpenXML](/architecture/openxml-conformance) - la definition formale de "supporte" utilisee par le manifeste de couverture.
