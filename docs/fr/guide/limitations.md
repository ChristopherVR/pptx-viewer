---
title: Limitations
description: Ce qui n'est pas supporte dans le moteur principal et les liaisons de visualiseur - a lire avant d'adopter la bibliotheque.
---

# Limitations

::: warning A lire avant d'adopter
`pptx-viewer` couvre une grande surface de la specification OpenXML, mais certaines choses sont approximees, en lecture seule, ou limitees par la plateforme du navigateur. Cette page liste uniquement ce que vous **ne pouvez pas** faire, ou seulement partiellement. Tout ce qui n'est pas liste ici se charge, s'edite, se rend et s'enregistre normalement; voir [Conformite OpenXML](/architecture/openxml-conformance) pour le manifeste de couverture formel.
:::

## Moteur principal (`pptx-viewer-core`)

- **Hyperliens, incrustations OLE et elements non pris en charge dans `.ppt`** - L'encre et SmartArt s'exportent toujours en image rasterisee : PowerPoint les garde tous deux reellement modifiables via une propriete de forme non documentee (`OfficeArtTertiaryFOPT` id `0x3A9`) qu'une tentative de reproduction de zero n'a pas reussi a repliquer. Les graphiques s'exportent aussi en image, ce qui correspond au plafond propre de PowerPoint : il incruste un objet MS Graph heritee sans specification publique, donc en ecrire un natif n'est pas prevu ; les modeles 3D se degradent en image de la meme facon que l'export de PowerPoint lui-meme, ce qui n'est donc pas une lacune. Les hyperliens, actions de clic, incrustations OLE et audio WAV sont tous restitues sans perte ; voir [Conformite OpenXML](/architecture/openxml-conformance#ppt-export-ceiling) pour les preuves de mesure.
- **Mise en page SmartArt** - Quand le fichier contient le dessin precompile de PowerPoint, cette mise en page exacte est utilisee. Sinon, un interpreteur DiagramML la reconstruit, egalant l'ensemble de formes de PowerPoint sur 226 des 227 fixtures de galerie mesurees et sa geometrie a 1 % pres pour les familles cycle, radial, hierarchie et pyramide. Reste ouvert : les tailles de police exactes sur les modeles d'element a plusieurs roles, les organigrammes profonds au-dela de la troisieme generation, la voie des connecteurs en serpentin, et un paragraphe vide propre au preset Bubble Picture List ; voir [Conformite OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) pour les preuves de mesure.

### Creation d'animations

Un effet cree dans le panneau d'animation est reconcilie dans l'arbre `p:timing` existant de la diapositive; les effets propres au fichier restent octet-identiques. Les 27 familles de filtres SMIL (`p:animEffect/@filter`) produisent un effet reel qui correspond a la lecture propre de PowerPoint, y compris `pixelate`, qui affiche par defaut exactement le comportement que PowerPoint lui-meme affiche (saut instantane a l'etat final) ; voir [Fidelite des effets visuels](/guide/visual-effects) pour les preuves. `image`, la 27e famille, n'est pas non plus une lacune : voir [Conformite OpenXML](/architecture/openxml-conformance).

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

- **Formes et scenes 3D (`a:sp3d`/`a:scene3d`)** - Les presets de camera, les surcharges explicites `a:camera` (a un axe et combinees), les panneaux d'extrusion, les rigs d'eclairage, les profils de biseau et les materiaux sont tous mesures par COM et implementes comme des techniques CSS/SVG exactes (homographies `matrix3d`, panneaux lateraux `translateZ`, un filtre d'eclairage SVG). Deux lacunes restent : trois profils de biseau (`relaxedInset`, `slope`, `hardEdge`) presentent une double transition clair-puis-sombre en coupe transversale que le modele de hauteur monotone ne peut pas totalement reproduire, et un defaut de couplage entre l'elevation speculaire et diffuse apparu apres la calibration par COM de l'elevation du rig : `metal` sature et l'erreur moyenne de luminosite de `matte` monte a environ 47,4 sous les rigs a haute elevation. Voir [Fidelite des effets visuels](/guide/visual-effects) pour les preuves de mesure completes.
- **Deformations de texte WordArt** - La deformation du contour par glyphe (une deformation exacte, point par point, du contour vectoriel reel quand le fichier de police est disponible) et l'enveloppe verticale sont mesurees et terminees. Deux approximations restent : PowerPoint repartit les glyphes de l'enveloppe bord a bord sur le cadre, et bien que ce moteur de rendu le reproduise desormais en etirant la ligne, les presets `can` gardent chaque glyphe a sa largeur naturelle (non etiree), laissant une erreur residuelle d'environ 5,3-18,5 % qu'aucun modele horizontal alternatif n'a comblee ; et quand aucun fichier de police n'est disponible, un ajustement affine par glyphe remplace la deformation exacte du contour, avec une precision d'environ 1-2 % pour des legendes ordinaires. Voir [Fidelite des effets visuels](/guide/visual-effects) pour les preuves de mesure completes.

## Metafichiers EMF/WMF (dependance `emf-converter`)

::: info Pas le code de ce depot
`emf-converter` est un paquet npm independant avec son propre depot; `pptx-viewer-core` ne fait que le consommer. Le tableau ci-dessous reflete ce que fait ce paquet aujourd'hui; en cas de divergence, ses propres notes de version font foi.
:::

::: warning API Canvas requise
La conversion de metafichiers necessite `OffscreenCanvas` ou `HTMLCanvasElement`. Node.js pur sans polyfill canvas n'est pas supporte pour les images EMF/WMF (le reste du moteur principal fonctionne bien dans Node).
:::

- **Pinceaux de degrade** - Les degrades lineaires et radiaux GDI+ sont deja rendus de facon exacte, y compris les arrets de couleur, les preselections, les facteurs de fondu et les transformations. La version a venir ajoute le pavage WrapMode pour les degrades lineaires alignes sur les axes ; les degrades pavages en angle et les degrades de chemin pavages restent limites (clamp) au lieu d'etre pavages.
- **Operations raster** - Les modes GDI ROP2 de plume et de pinceau sont deja rendus de facon exacte. La version a venir ajoute des operations ROP3 exactes pixel par pixel pour `BitBlt`/`StretchBlt`/`StretchDIBits` : `SRCCOPY`, `SRCPAINT`, `SRCAND`, `SRCINVERT`, `SRCERASE`, `NOTSRCCOPY`, `NOTSRCERASE`, `MERGEPAINT`, `PATCOPY`, `DSTINVERT`, `BLACKNESS`, `WHITENESS`. `MERGECOPY`, `PATPAINT` et `PATINVERT` restent degrades en simple copie.
- **Texte** - Utilise le moteur de polices du navigateur; les metriques de glyphes peuvent differer de GDI Windows. La version a venir respecte exactement les tableaux `dx` d'`ExtTextOut`, conserve le signe de la hauteur `LOGFONT`, fait pivoter le texte selon l'escapement/l'orientation et corrige un decalage errone du nom de police; sans tableau `dx`, l'espacement des glyphes depend toujours de la substitution de police du navigateur.

## Lectures connexes

- [Introduction](/fr/guide/introduction) - ce que le projet supporte globalement.
- [Architecture](/fr/guide/architecture) - pourquoi ces compromis existent.
- [Conformite OpenXML](/architecture/openxml-conformance) - la definition formale de "supporte" utilisee par le manifeste de couverture.
