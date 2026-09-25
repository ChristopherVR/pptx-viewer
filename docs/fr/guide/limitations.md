---
title: Limitations
description: Ce qui n'est pas supporte dans le moteur principal et les liaisons de visualiseur - a lire avant d'adopter la bibliotheque.
---

# Limitations

::: warning A lire avant d'adopter
`pptx-viewer` couvre une grande surface de la specification OpenXML, mais certaines choses sont approximees, en lecture seule, ou limitees par la plateforme du navigateur. Cette page recense les limitations connues; elle ne garantit pas de maniere exhaustive la compatibilite avec chaque fonctionnalite Office ou extension tierce. Verifiez `data.warnings` apres le chargement d'un fichier et consultez [Conformite OpenXML](/architecture/openxml-conformance) pour le manifeste de couverture formel.
:::

## Moteur principal (`pptx-viewer-core`)

| Fonctionnalite        | Statut                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export `.ppt`         | Partiel                            | L'encre, SmartArt, les graphiques et les modeles 3D se rouvrent desormais dans PowerPoint comme des objets modifiables, via un paquet OOXML d'aller-retour incorpore (verifie en rouvrant le fichier dans PowerPoint par COM); seul PowerPoint 97-2003 lui-meme voit le repli. Toujours avec perte : les images autres que PNG/JPEG deviennent un espace reserve, les surcharges de style de texte propres au masque de la presentation ne sont pas ecrites, la video et l'audio autre que WAV se degradent en image, et l'import de fichiers `.ppt` chiffres ne prend en charge que RC4 CryptoAPI. Voir [Conformite OpenXML](/architecture/openxml-conformance#ppt-export-ceiling).               |
| Mise en page SmartArt | Approximative sans dessin en cache | Les presentations enregistrees sans le `dsp:drawing` mis en cache sont mises en page par un moteur DiagramML par point (131 mises en page) ou par l'ancien interpreteur par familles. Sur 229 fixtures de galerie creees par COM, 228 produisent l'ensemble de formes de PowerPoint, 126 correspondent a sa geometrie a 1 % pres (161 a 5 %) et 114 a chaque taille de police. Les mises en page dont les zones grandissent avec le texte (liste a puces verticale, liste de zones verticale), les assistants d'organigramme et les cartes "Meet the Team" restent inexacts. Voir [Conformite OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) pour les preuves de mesure. |

### Creation d'animations

Un effet cree dans le panneau d'animation est reconcilie dans l'arbre `p:timing` existant de la diapositive; les effets propres au fichier restent octet-identiques. Lacunes connues :

- **Les effets d'entree/sortie enregistres sont lus comme un fondu dans PowerPoint.** Le writer enregistre le bon preset mais n'emet qu'un comportement de fondu, de sorte qu'un "Entree en vol" enregistre ici est lu comme un fondu a l'ouverture du fichier dans PowerPoint (ce visualiseur le lit correctement). Plusieurs effets d'emphase (pulsation, vague, rebond, vague de couleur, clignotement, scintillement) sont ecrits comme des no-op.
- **Certaines familles de filtres et presets sont approximees a la lecture :** `strips` est lu comme un balayage de bord, `wedge` comme un hexagone grandissant, `slide`/`cover`/`uncover`/`push`/`pull` partagent un seul effet d'entree en vol, et 45 identifiants de presets PowerPoint jouent un effet de substitution (par exemple, Pivotement simple et Sortie flottante sont lus comme un fondu). Stores, Damier, Roue et Barres aleatoires ignorent leur sous-type.
- **Pas encore pris en charge :** l'ondulation lettre par lettre au sein d'une construction par paragraphe, et la creation des transitions p15 (elles sont lues quand elles sont presentes dans un fichier, mais leurs options de direction sont ignorees); un `p14:bounceEnd` de 100 % (plus aucun trajet, rendu de facon erratique par PowerPoint lui-meme) est plafonne a 95 %. Les declencheurs sur un signet de media ("Sur signet") se creent dans les cinq bindings, et la courbe d'amortissement du rebond final est ajustee sur les images de PowerPoint lui-meme.

### Detecter les lacunes a l'execution

Vous n'avez pas a deviner si un fichier a rencontre une limitation. Le pipeline de chargement signale de nombreuses constructions non supportees ou approximees (pas toutes : les substituts d'animation, par exemple, ne declenchent aucun avertissement) dans `data.warnings`, type `PptxCompatibilityWarning` :

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

Verifiez `data.warnings` apres `load()` (et apres `save()`) si votre application doit afficher des avis de fidelite ou activer des fonctionnalites selon le fichier.

Voir [Environnements d'execution](/guide/runtime-environments) pour savoir ou s'execute chaque partie de `pptx-viewer` (navigateur / Node.js / Web Worker) et le comportement specifique a la plateforme qui decoule du bac a sable du navigateur plutot que d'une fonctionnalite manquante.

## Visualiseurs de framework (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning Le rendu base sur CSS echange certains effets visuels contre de la fidelite ailleurs
Les diapositives sont rendues en HTML/CSS plutot qu'en Canvas, ce qui donne un texte net a n'importe quel zoom, une accessibilite native et une interactivite DOM. La contrepartie est que quelques effets PowerPoint n'ont pas d'equivalent CSS exact et sont approximes.
:::

### Approximations des effets visuels

| Effet                                                                                              | Statut                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formes et scenes 3D (`a:sp3d`/`a:scene3d`)                                                         | Residu metallique                                              | Les materiaux metalliques delavaient auparavant sous des rigs d'eclairage a forte elevation; la lumiere speculaire a maintenant sa propre elevation plafonnee, reajustee sur 134 rendus PowerPoint (erreur absolue moyenne de 75,0 a 36,4 sur une echelle de 0-255), de sorte qu'un residu plus faible subsiste. La correction des biseaux relaxedInset/slope/hardEdge du 16/09/2026 n'a pas encore ete revalidee face a un rendu PowerPoint recent. Voir [Fidelite des effets visuels](/guide/visual-effects) pour la provenance. |
| Deformations de texte WordArt (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Interieur du preset "can" et polices sans fichier non verifies | Les presets `can` placent desormais les glyphes selon la loi d'espacement lineaire mesuree de PowerPoint (derivee par COM, independante de la valeur d'ajustement de courbe). Reste ouvert : remesurer l'erreur de contour interieur restante des presets `can` par rapport a PowerPoint, et valider face a PowerPoint le trace de contour utilise pour les polices dont le fichier n'est pas disponible. Voir [Fidelite des effets visuels](/guide/visual-effects) pour la provenance.                                            |

Les reflets, les bords doux et les degrades de chemin sont aussi des approximations, mais tiennent bien face au vrai PowerPoint; voir [Fidelite des effets visuels](/guide/visual-effects) pour la technique et les preuves mesurees par COM derriere chacune d'elles.

### Lacunes connues de rendu et d'edition (audit 09/2026)

Un audit de septembre 2026 face au vrai PowerPoint a trouve ces lacunes encore ouvertes :

- **L'enregistrement d'une diapositive editee peut encore toucher des details mineurs du balisage.** Les equations, les sauts de ligne, le formatage herite, les styles de texte du masque, les arriere-plans de theme, les horodatages des commentaires, les remplissages d'image, les actions de clic sur les medias, les langues et proprietes des fragments, les couleurs d'ombre interieure, les marges de degrade et les graphiques non touches sont desormais conserves; un petit reste d'attributs rares (par exemple certains `buClr`, `tabLst@algn` et metadonnees d'animation/audio) peut encore differer sur une diapositive reecrite. Les diapositives non editees font un aller-retour propre.
- **Texte :** la ponctuation CJK que PowerPoint laisse depasser la marge droite (`hangingPunct`) passe a la ligne suivante, car seul Safari implemente la ponctuation suspendue en CSS, et `eaLnBrk="0"` ne desactive pas les regles de coupure de ligne d'Asie orientale (kinsoku) comme le fait PowerPoint.
- **Graphiques :** les bulles de legende et les lignes de repere des etiquettes de donnees ne sont dessinees que pour les graphiques en barres et en colonnes.
- **Animations et transitions :** la direction de la transition Zoom, la creation d'un declencheur sur un signet multimedia et la forme exacte de la courbe d'amortissement `p14:bounceEnd` ne correspondent pas encore a PowerPoint.
- **Les modeles 3D** ignorent la camera, la transformation et les eclairages crees dans PowerPoint.
- **La couverture de l'editeur** est un sous-ensemble de celle de PowerPoint : plusieurs galeries du ruban ne sont pas encore disponibles. Modifier les points (avec les outils de dessin Forme libre : forme et Courbe), Fusionner les formes, le recadrage des images sur le canevas (poignees de recadrage, Rogner selon les proportions, Remplissage, Ajuster), le collage special, les menus contextuels du canevas et des elements, la selection multiple dans le volet des diapositives, l'apercu reel des animations et les raccourcis d'edition standard sont disponibles dans les cinq bindings.

## Metafichiers EMF/WMF (dependance `emf-converter`)

::: info Pas le code de ce depot
`emf-converter` est un paquet npm independant avec son propre depot; `pptx-viewer-core` ne fait que le consommer. Le tableau ci-dessous reflete ce que fait ce paquet aujourd'hui; en cas de divergence, ses propres notes de version font foi.
:::

::: warning API Canvas requise
La conversion de metafichiers necessite `OffscreenCanvas` ou `HTMLCanvasElement`. Node.js pur sans polyfill canvas n'est pas supporte pour les images EMF/WMF (le reste du moteur principal fonctionne bien dans Node).
:::

| Fonctionnalite      | Statut                          | Notes                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinceaux de degrade | Arrets exacts et pavage         | Les degrades lineaires et radiaux GDI+ rendent des arrets de couleur, presets, facteurs de fondu et transformations exacts. Depuis emf-converter 3.1.0, le pavage `WrapMode` fonctionne a n'importe quel angle et les degrades de chemin suivent la forme de leur limite (a 1-6 % pres de Windows GDI+ selon le mode de pavage). Les pinceaux de texture (image) rendent toujours un noir uni. |
| Operations raster   | ROP3 exact                      | Depuis 3.1.0, les 256 codes ROP3 sont evalues de facon exacte pour `BitBlt`/`StretchBlt`/`StretchDIBits`. Les modes de plume ROP2 bit a bit (AND/OR/XOR) sont approximes.                                                                                                                                                                                                                      |
| Texte               | Moteur de polices du navigateur | Les metriques de glyphes peuvent differer de GDI Windows. Depuis 3.1.0, les tableaux `dx` d'`ExtTextOut`, le signe de la hauteur `LOGFONT` et l'escapement sont respectes; sans tableau `dx`, l'espacement depend de la substitution de police du navigateur. Les transformations de monde pivotees ou cisaillees dans les metafichiers GDI purs (non GDI+) ne sont pas appliquees.            |

## Lectures connexes

- [Introduction](/fr/guide/introduction) - ce que le projet supporte globalement.
- [Architecture](/fr/guide/architecture) - pourquoi ces compromis existent.
- [Conformite OpenXML](/architecture/openxml-conformance) - la definition formale de "supporte" utilisee par le manifeste de couverture.
- [Fidelite des effets visuels](/guide/visual-effects) - approximations d'effets CSS/SVG confirmees face au vrai PowerPoint.
- [Environnements d'execution](/guide/runtime-environments) - ou s'execute chaque partie de `pptx-viewer`, et notes de plateforme sur le bac a sable du navigateur.
