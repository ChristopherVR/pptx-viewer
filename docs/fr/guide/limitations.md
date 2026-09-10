---
title: Limitations
description: Ce qui n'est pas supporte dans le moteur principal et les liaisons de visualiseur - a lire avant d'adopter la bibliotheque.
---

# Limitations

::: warning A lire avant d'adopter
`pptx-viewer` couvre une grande surface de la specification OpenXML, mais certaines choses sont approximees, en lecture seule, ou limitees par la plateforme du navigateur. Cette page liste uniquement ce que vous **ne pouvez pas** faire, ou seulement partiellement. Tout ce qui n'est pas liste ici se charge, s'edite, se rend et s'enregistre normalement; voir [Conformite OpenXML](/architecture/openxml-conformance) pour le manifeste de couverture formel.
:::

## Moteur principal (`pptx-viewer-core`)

- **Hyperliens, incrustations OLE et elements non pris en charge dans `.ppt`** - L'encre, SmartArt, les graphiques et les modeles 3D s'exportent tous depuis `.ppt` en image rasterisee plutot qu'en objet modifiable, car le veritable chemin d'edition propre a PowerPoint pour l'encre et SmartArt repose sur une propriete de forme non documentee, et son repli pour les graphiques et la 3D correspond a un format herite sans specification publique. Voir [Conformite OpenXML](/architecture/openxml-conformance#ppt-export-ceiling) pour les preuves de mesure.
- **Mise en page SmartArt** - Les presentations enregistrees sans le `dsp:drawing` mis en cache sont mises en page par l'interpreteur, qui reproduit 226 des 227 fixtures de galerie creees par COM a 1 % pres; voir [Conformite OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) pour les preuves de mesure.

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

- **Formes et scenes 3D (`a:sp3d`/`a:scene3d`)** - Les biseaux relaxedInset, slope et hardEdge presentent une coupe transversale claire puis sombre que le modele de hauteur unique ne peut pas reproduire, et les materiaux `metal` saturent sous des rigs d'eclairage a forte elevation car le terme speculaire est couple a l'elevation diffuse. Tout le reste du modele 3D est mesure par COM; voir [Fidelite des effets visuels](/guide/visual-effects) pour les preuves.
- **Deformations de texte WordArt** - Les presets `can` conservent un residu horizontal de 5-18 % car l'espacement des glyphes de PowerPoint le long du cylindre n'est pas encore derive, et les polices dont le fichier n'est pas disponible se rabattent sur un ajustement affine par glyphe (environ 1-2 % d'ecart) au lieu de la deformation exacte du contour; un paragraphe tres court et fortement etire peut encore empieter legerement sur la ligne voisine. Voir [Fidelite des effets visuels](/guide/visual-effects) pour les preuves.

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
