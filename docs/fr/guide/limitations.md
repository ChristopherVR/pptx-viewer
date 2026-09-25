---
title: Limitations
description: Ce que le moteur principal et les liaisons de visionneuse ne prennent pas en charge - à lire avant d'adopter la bibliothèque.
---

# Limitations

::: warning À lire avant d'adopter la bibliothèque
`pptx-viewer` couvre une large part de la spécification OpenXML, mais certains éléments sont approximés, en lecture seule ou limités par la plateforme du navigateur. Cette page recense les limitations connues ; elle ne constitue pas une garantie exhaustive de compatibilité avec chaque fonctionnalité d'Office ou extension tierce. Vérifiez `data.warnings` après avoir chargé une présentation et consultez [Conformité OpenXML](/architecture/openxml-conformance) pour le manifeste de couverture formel.
:::

## Moteur principal (`pptx-viewer-core`)

| Fonctionnalité       | Statut                             | Remarques                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export `.ppt`        | Partiel                            | L'encre, SmartArt, les graphiques et les modèles 3D se rouvrent désormais dans PowerPoint comme objets modifiables grâce à un package OOXML aller-retour intégré (vérifié en les rouvrant dans PowerPoint via COM) ; seul PowerPoint 97-2003 lui-même voit la représentation de secours. Pertes restantes : les images autres que PNG/JPEG deviennent un espace réservé, les remplacements de styles de texte du masque propres à la présentation ne sont pas écrits, la vidéo et l'audio autre que WAV sont réduits à une image, et l'import de `.ppt` chiffrés ne prend en charge que RC4 CryptoAPI. Voir [Conformité OpenXML](/architecture/openxml-conformance#ppt-export-ceiling).   |
| Disposition SmartArt | Approximative sans dessin en cache | Les présentations enregistrées sans le `dsp:drawing` en cache sont mises en page par un moteur DiagramML par point (131 dispositions) ou par l'ancien interpréteur par famille. Sur 229 fixtures de galerie créées via COM, 228 produisent le même ensemble de formes que PowerPoint, 126 reproduisent sa géométrie à 1 % près (161 à 5 % près) et 114 respectent chaque taille de police. Les dispositions dont les zones grandissent avec leur texte (Vertical Bullet List, Vertical Box List), les assistants d'organigramme et les cartes Meet the Team restent inexacts. Voir [Conformité OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) pour les mesures. |

### Création d'animations

Un effet créé dans le volet d'animation est intégré à l'arbre `p:timing` existant de la diapositive ; les effets propres à la présentation restent identiques octet pour octet. Lacunes connues :

- **Quelques effets enregistrés se rabattent encore sur un fondu dans PowerPoint.** Les effets d'entrée, de sortie et d'accentuation sont écrits avec l'arbre de comportement propre à PowerPoint (Balayer, Flottant, Rebondir, Agrandir et tourner, les révélations par filtre, Pulsation, Bascule, Vague et d'autres, vérifié en les rouvrant dans PowerPoint) ; Ramper et Spirale sont encore enregistrés comme un fondu, et Clignotement est une approximation.
- **Certaines familles de filtres et certains préréglages sont approximés à la lecture :** `strips` est joué comme un balayage depuis le bord, `wedge` comme un hexagone qui grandit, `slide`/`cover`/`uncover`/`push`/`pull` partagent une même entrée par balayage, et 45 ID de préréglages PowerPoint jouent un effet de substitution (par exemple Pivot simple et Sortie flottante sont joués comme un fondu).
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

| Effet                                                                                                 | Statut                                                | Remarques                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formes et scènes 3D (`a:sp3d` / `a:scene3d`)                                                          | Résidu sur le métal                                   | Les matériaux métalliques paraissaient délavés sous des éclairages à forte élévation ; la lumière spéculaire a désormais sa propre élévation plafonnée, réajustée sur 134 rendus PowerPoint (erreur absolue moyenne de 75,0 à 36,4 sur une échelle de 0-255), si bien qu'il reste un résidu plus faible. La correction des biseaux relaxedInset/slope/hardEdge du 2026-09-16 n'a pas encore été revérifiée sur un nouveau rendu PowerPoint. Voir [Fidélité des effets visuels](/guide/visual-effects) pour la provenance. |
| Déformations d'enveloppe WordArt (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Intérieur de can et polices sans fichier non vérifiés | Les préréglages can placent désormais les glyphes selon la loi d'espacement linéaire mesurée dans PowerPoint (obtenue via COM, indépendante de la valeur d'ajustement de la courbe). Reste à faire : remesurer par rapport à PowerPoint l'erreur de contour intérieur restante des préréglages can, et valider par rapport à PowerPoint le tracé de contour utilisé pour les polices dont le fichier n'est pas disponible. Voir [Fidélité des effets visuels](/guide/visual-effects) pour la provenance.                  |

Les réflexions, les bords adoucis et les dégradés de tracé sont aussi des approximations, mais tiennent bien la comparaison avec le vrai PowerPoint ; voir [Fidélité des effets visuels](/guide/visual-effects) pour la technique et les mesures COM qui étayent chacun d'eux.

### Lacunes connues de rendu et d'édition (audit de 2026-09)

Un audit de septembre 2026 mené contre le vrai PowerPoint a relevé ces lacunes toujours ouvertes :

- **Enregistrer une diapositive modifiée peut encore toucher des détails mineurs du balisage.** Les équations, les sauts de ligne, la mise en forme héritée, les styles de texte du masque, les arrière-plans du thème, les horodatages des commentaires, les remplissages d'image, les actions au clic sur les médias, les langues et les propriétés des segments de texte, les couleurs d'ombre intérieure, les retraits de dégradé et les graphiques non modifiés font désormais l'aller-retour ; de même que les couleurs de puce sur une puce héritée, l'alignement de tabulation par défaut défini explicitement, les métadonnées d'animation et d'audio joué sur plusieurs diapositives, et une liste d'auteurs de commentaires inutilisée. Un petit résidu subsiste sur une diapositive réécrite : certains attributs de segment (`err`, `b`) et les propriétés des segments ruby sont écrits explicitement, certaines formes reçoivent une largeur de contour explicite, et la révision, l'heure de modification et le nombre de diapositives de `docProps` sont actualisés. Les diapositives non modifiées font l'aller-retour sans changement.
- **Texte :** la ponctuation CJK que PowerPoint laisse déborder de la marge droite (`hangingPunct`) passe à la ligne suivante, car seul Safari implémente la ponctuation suspendue en CSS, et `eaLnBrk="0"` ne désactive pas les règles de coupure de ligne d'Asie orientale (kinsoku) comme le fait PowerPoint.
- **Graphiques :** les zones de légende et les lignes de repère des étiquettes de données ne sont dessinées que pour les graphiques à barres et à colonnes.
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
