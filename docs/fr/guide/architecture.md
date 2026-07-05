---
title: Architecture
description: Comment les couches de pptx-viewer s'articulent - le pipeline de chargement, la composition par mixins et le rendu CSS des composants de visualiseur.
---

# Architecture

Cette page explique comment les couches de `pptx-viewer` s'articulent entre elles.

## Apercu des couches

```
Framework viewers (React / Vue / Angular)
         │
pptx-viewer-shared      ← logique de rendu independante du framework
         │
pptx-viewer-core        ← moteur : analyse, edition, serialisation
    ├── emf-converter   ← metafichiers EMF/WMF → PNG
    └── mtx-decompressor ← polices MicroType Express
```

## Le package Core

Le package Core (`pptx-viewer-core`) est un moteur purement TypeScript qui s'execute dans n'importe quel environnement JavaScript.

### Pipeline de chargement

1. L'appelant passe un `ArrayBuffer` a `handler.load(buffer)`.
2. JSZip extrait l'archive ZIP OpenXML.
3. fast-xml-parser analyse le XML des parties.
4. Les modules de parsing construisent un `PptxData` structure.
5. Les themes, masques et mises en page sont resolus et attaches.

### Pipeline de sauvegarde

1. Les diapositives modifiees sont serialisees en XML OpenXML.
2. Les relations et types de contenu sont reconstruits.
3. JSZip repackage tout en un `Uint8Array`.

## La composition par mixins du Runtime

`PptxHandlerRuntime` est compose de 50+ modules de mixins, chacun gerant un aspect specifique (parsing de texte, graphiques, animations, etc.). Ce pattern maintient les modules petits et concentres.

## Les packages de visualiseur

Chaque package de visualiseur (React, Vue, Angular) contient :

- **Composants de rendu** - convertissent `PptxElement` en HTML/CSS/SVG.
- **Etat reactif** - gestion de la selection, du zoom, de l'historique d'edition.
- **Hooks/composables** - expose les operations du visualiseur (React : 67+ hooks personnalises).
- **Barre d'outils** - le ruban Office en Tailwind CSS.

## Le rendu CSS

Les diapositives sont rendues en HTML et CSS, pas en Canvas. Cela donne :

- Un texte net a n'importe quel zoom.
- Une accessibilite native (selection de texte, lecteurs d'ecran).
- Une interactivite DOM.

La contrepartie est documentee dans les [Limitations](/fr/guide/limitations).

## Lectures connexes

- [Concepts fondamentaux](/fr/guide/concepts) - unites EMU et modele d'elements.
- [Le modele PptxData](/fr/guide/data-model) - la structure des donnees analysees.
