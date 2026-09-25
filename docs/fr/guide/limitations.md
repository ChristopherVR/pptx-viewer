---
title: Limitations
description: Ce que le moteur principal et les liaisons de visionneuse ne prennent pas en charge - à lire avant d'adopter la bibliothèque.
---

# Limitations

::: warning À lire avant d'adopter la bibliothèque
`pptx-viewer` couvre une large part de la spécification OpenXML, mais certains éléments sont approximés, en lecture seule ou limités par la plateforme du navigateur. Cette page recense les limitations connues ; elle ne constitue pas une garantie exhaustive de compatibilité avec chaque fonctionnalité d'Office ou extension tierce. Vérifiez `data.warnings` après avoir chargé une présentation et consultez [Conformité OpenXML](/architecture/openxml-conformance) pour le manifeste de couverture formel.
:::

## Moteur principal (`pptx-viewer-core`)

| Fonctionnalité       | Statut                             | Remarques                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export `.ppt`        | Partiel                            | L'encre, SmartArt, les graphiques et les modèles 3D se rouvrent désormais dans PowerPoint comme objets modifiables grâce à un package OOXML aller-retour intégré (vérifié en les rouvrant dans PowerPoint via COM) ; seul PowerPoint 97-2003 lui-même voit la représentation de secours. Pertes restantes : les images autres que PNG/JPEG deviennent un espace réservé, les remplacements de styles de texte du masque propres à la présentation ne sont pas écrits, la vidéo et l'audio autre que WAV sont réduits à une image, et l'import de `.ppt` chiffrés ne prend en charge que RC4 CryptoAPI. Voir [Conformité OpenXML](/architecture/openxml-conformance#ppt-export-ceiling).                               |
| Disposition SmartArt | Approximative sans dessin en cache | Les présentations enregistrées sans le `dsp:drawing` en cache sont mises en page par un moteur DiagramML par point (143 dispositions) ou par l'ancien interpréteur par famille. Sur 229 fixtures de galerie créées via COM, 228 produisent le même ensemble de formes que PowerPoint, 143 reproduisent sa géométrie à 1 % près (181 à 5 % près) et 129 respectent chaque taille de police. Name and Title Organization Chart, les hiérarchies étiquetées et en tableau, les organigrammes horizontaux avec assistants et trois dispositions (Arrow Ribbon, Balance, Varying Width List) restent inexacts. Voir [Conformité OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) pour les mesures. |

### Création d'animations

Un effet créé dans le volet d'animation est intégré à l'arbre `p:timing` existant de la diapositive ; les effets propres à la présentation restent identiques octet pour octet. Lacunes connues :

- **Quelques effets enregistrés se rabattent encore sur un fondu dans PowerPoint.** Les effets d'entrée, de sortie et d'accentuation sont écrits avec l'arbre de comportement propre à PowerPoint (Balayer, Flottant, Rebondir, Agrandir et tourner, les révélations par filtre, Pulsation, Bascule, Vague et d'autres, vérifié en les rouvrant dans PowerPoint) ; Ramper et Spirale sont encore enregistrés comme un fondu, et Clignotement est une approximation.
- **Certains préréglages sont approximés à la lecture :** `strips`, `wedge`, la sortie en cercle et le filtre `slide` sont joués comme le fait PowerPoint (calés sur ses propres images enregistrées), et `cover`/`uncover`/`push`/`pull` coupent comme le fait PowerPoint ; environ 40 ID de préréglages PowerPoint jouent encore un effet de substitution (par exemple Pivot simple et Sortie flottante sont joués comme un fondu), et les libellés du catalogue de préréglages pour les ID 27 et au-delà ne correspondent pas encore tous aux noms de PowerPoint.
- **Pris en charge partiellement :** l'ondulation lettre par lettre au sein d'une animation par paragraphe n'est pas jouée ; un `p14:bounceEnd` de 100 % (plus aucune course restante, ce que PowerPoint lui-même rend de façon erratique) est limité à 95 %. Les déclencheurs sur signet multimédia (« Sur signet »), les transitions p15 avec leurs options de direction et la direction Avant/Arrière de la transition Zoom peuvent être créés dans les cinq liaisons, et la courbe d'amortissement de « Fin rebondissante » est ajustée sur les images de PowerPoint lui-même.

### Détecter les lacunes à l'exécution

Inutile de deviner si un fichier touche une limitation. Le pipeline de chargement signale de nombreuses constructions non prises en charge ou approximées (pas toutes : les effets d'animation de substitution, par exemple, ne déclenchent aucun avertissement) dans `data.warnings`, typées `PptxCompatibilityWarning` :

```ts
interface PptxCompatibilityWarning {
	code: string; // stable machine-readable code
	message: string;
	severity: 'info' | 'warning';
	scope: 'presentation' | 'slide' | 'element' | 'save';
	slideId?: string; // present for slide/element-scoped warnings
	elementId?: string;
	xmlPath?: string; // where in the package the construct lives
}
```

Vérifiez `data.warnings` après `load()` (et après `save()`) si votre application doit signaler des écarts de fidélité aux utilisateurs ou activer des fonctionnalités selon le fichier.

Consultez [Environnements d'exécution](/guide/runtime-environments) pour savoir où s'exécute chaque partie de `pptx-viewer` (navigateur / Node.js / Web Worker) et quels comportements propres à la plateforme découlent du bac à sable du navigateur plutôt que d'une fonctionnalité manquante.

## Visionneuses pour frameworks (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning Le rendu basé sur CSS sacrifie quelques effets visuels au profit de la fidélité ailleurs
Les diapositives sont rendues en HTML/CSS plutôt qu'en Canvas, ce qui donne un texte net à tout niveau de zoom, une accessibilité native et l'interactivité du DOM. La contrepartie est que quelques effets de PowerPoint n'ont pas d'équivalent CSS exact et sont approximés.
:::

### Approximations d'effets visuels

| Effet                                                                                                 | Statut                                           | Remarques                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formes et scènes 3D (`a:sp3d` / `a:scene3d`)                                                          | Résidu sur le métal                              | Les matériaux métalliques paraissaient délavés sous des éclairages à forte élévation ; la lumière spéculaire a désormais sa propre élévation plafonnée, réajustée sur 134 rendus PowerPoint (erreur absolue moyenne de 75,0 à 36,4 sur une échelle de 0-255), si bien qu'il reste un résidu plus faible. La correction des biseaux relaxedInset/slope/hardEdge du 2026-09-16 n'a pas encore été revérifiée sur un nouveau rendu PowerPoint. Voir [Fidélité des effets visuels](/guide/visual-effects) pour la provenance.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Déformations d'enveloppe WordArt (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Préréglages can inexacts à certaines profondeurs | Les glyphes sont placés selon la longueur d'arc le long des courbes supérieure et inférieure. Mesuré à nouveau face au `Slide.Export` de PowerPoint (1920 px de large, Noto Sans, Verdana et Arial, 2026-09-25) : les préréglages can atteignent un IoU d'encre de 0,94-0,97 avec une erreur de contour moyenne de 0,8-1,7 px (95e centile 1,5-6 px) à la plupart des profondeurs, et `inflate` / `deflate` 0,96-0,97. Pour 9 des 20 valeurs `adj` balayées (`textCanUp` 80000-93333, `textCanDown` 3333-23333), PowerPoint arrête une ou deux lignes de texte environ 1,2 % de la largeur du cadre trop tôt et incline les glyphes ; ce comportement n'est pas modélisé (IoU de 0,73-0,86 dans ces cas). Les polices dont le fichier est introuvable utilisent un contour tracé à partir du rendu du navigateur, qui concorde avec le vrai fichier de police à 0,002 d'IoU près. Voir [Fidélité des effets visuels](/guide/visual-effects). |

Les réflexions, les bords adoucis et les dégradés de tracé sont aussi des approximations, mais tiennent bien la comparaison avec le vrai PowerPoint ; voir [Fidélité des effets visuels](/guide/visual-effects) pour la technique et les mesures COM qui étayent chacun d'eux.

### Lacunes connues de rendu et d'édition (audit de 2026-09)

Un audit de septembre 2026 mené contre le vrai PowerPoint a relevé ces lacunes toujours ouvertes :

- **Enregistrer une diapositive modifiée peut encore toucher des détails mineurs du balisage.** Les équations, les sauts de ligne, la mise en forme héritée, les styles de texte du masque, les arrière-plans du thème, les horodatages des commentaires, les remplissages d'image, les actions au clic sur les médias, les langues et les propriétés des segments de texte, les segments ruby, les largeurs de contour, les couleurs d'ombre intérieure, les retraits de dégradé, les couleurs de puce sur une puce héritée, l'alignement de tabulation, les métadonnées d'animation et d'audio, et les graphiques non modifiés font désormais l'aller-retour, et `docProps` est actualisé à l'enregistrement comme le fait PowerPoint. Un petit résidu subsiste sur une diapositive réécrite : un `<a:pPr/>` vide est supprimé, un `<a:p/>` nu se voit ajouter un segment vide, l'`endParaRPr` des notes et `prstTxWarp/avLst` peuvent disparaître, et les décomptes de mots et de paragraphes dans `docProps/app.xml` ne sont pas recalculés. Les diapositives non modifiées font l'aller-retour sans changement.
- **Texte :** la coupure de ligne d'Asie orientale suit, à l'intérieur d'une portion de texte, la ponctuation suspendue (`hangingPunct`) et les règles kinsoku (`eaLnBrk`) de PowerPoint, mais une coupure entre deux portions de texte d'Asie orientale mises en forme différemment suit toujours les règles du navigateur, et un `、` ou `。` suspendu suivi directement d'un crochet fermant passe à la ligne avec lui au lieu de déborder (pas encore comparé à PowerPoint).
- **Graphiques :** les zones et les bulles des étiquettes de données sont dimensionnées d'après une estimation de la largeur du texte plutôt que mesurées, et les étiquettes des graphiques en secteurs à la position `bestFit` sont placées plus près du centre que dans PowerPoint.
- **Les modèles 3D** ignorent la caméra, la transformation et les éclairages définis dans PowerPoint.
- **La couverture de l'éditeur** est un sous-ensemble de celle de PowerPoint : plusieurs galeries du ruban ne sont pas encore disponibles. Modifier les points (avec les outils de dessin Forme libre : forme et Courbe), Fusionner les formes, le rognage d'image sur le canevas (poignées de rognage, Rogner selon les proportions, Remplissage, Ajuster), le Collage spécial, les menus contextuels du canevas vide et des éléments, la sélection multiple dans le volet des diapositives, un véritable aperçu des animations sur place et les raccourcis d'édition standard sont disponibles dans les cinq liaisons.

## Métafichiers EMF/WMF (dépendance `emf-converter`)

::: info Ce n'est pas du code de ce dépôt
`emf-converter` est un package npm distinct doté de son propre dépôt ; `pptx-viewer-core` ne fait que le consommer. Le tableau ci-dessous décrit ce que fait ce package aujourd'hui ; si les deux venaient à diverger, ses propres notes de version font foi.
:::

::: warning API Canvas requise
La conversion des métafichiers nécessite `OffscreenCanvas` ou `HTMLCanvasElement`. Node.js pur sans polyfill canvas n'est pas pris en charge pour les images EMF/WMF (le reste du moteur principal fonctionne sans problème dans Node).
:::

| Fonctionnalité                    | Statut                          | Remarques                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinceaux de dégradé et de texture | Résidu de rééchantillonnage     | Les dégradés, les pinceaux à motif et les pinceaux de texture EMF+ (y compris les bitmaps compressés, depuis 3.3.0) sont rendus avec des arrêts de couleur et un pavage exacts ; le filtrage des motifs par le navigateur laisse une petite différence de lissage des bords par rapport à Windows GDI+ (mesurée dans le README du package).                                                                                                                                     |
| Opérations raster                 | Exactes                         | Les 256 codes ROP3 et tous les modes de stylet ROP2 bit à bit, y compris à l'intérieur des tracés `BeginPath`/`EndPath` (depuis 3.3.0), sont évalués exactement.                                                                                                                                                                                                                                                                                                                |
| Texte et transformations          | Moteur de polices du navigateur | Les métriques des glyphes peuvent différer de Windows GDI : les tableaux `dx` de `ExtTextOut`, le signe de la hauteur `LOGFONT` et l'escapement sont respectés, mais sans tableau `dx` l'espacement dépend de la substitution de polices du navigateur. Les transformations du monde avec rotation et cisaillement s'appliquent aux formes, aux transferts de blocs (blits) et au texte (depuis 3.3.0) ; le texte soumis à un cisaillement utilise un angle de rotation unique. |

## Pour aller plus loin

- [Introduction](/fr/guide/introduction) - ce que le projet prend en charge dans son ensemble.
- [Architecture](/fr/guide/architecture) - pourquoi ces compromis existent.
- [Conformité OpenXML](/architecture/openxml-conformance) - la définition formelle de « pris en charge » utilisée par le manifeste de couverture.
- [Fidélité des effets visuels](/guide/visual-effects) - approximations d'effets CSS/SVG confirmées par rapport au vrai PowerPoint.
- [Environnements d'exécution](/guide/runtime-environments) - où s'exécute chaque partie de `pptx-viewer`, et remarques de plateforme sur le bac à sable du navigateur.
