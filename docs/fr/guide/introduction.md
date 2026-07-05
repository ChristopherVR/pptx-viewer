---
title: Qu'est-ce que pptx-viewer ?
description: Un apercu general du monorepo TypeScript pptx-viewer pour analyser, editer, afficher et convertir des fichiers PowerPoint avec React, Vue 3 et Angular.
---

# Qu'est-ce que pptx-viewer ?

`pptx-viewer` est un monorepo TypeScript complet pour **analyser, editer, afficher et convertir** des fichiers Microsoft PowerPoint (`.pptx`) - dans le navigateur et dans Node.js. Il fonctionne entierement en memoire sur l'archive ZIP OpenXML sans aucune dependance native.

La ou la plupart des bibliotheques PowerPoint font une seule chose - generer des diapositives _ou_ les afficher _ou_ en extraire du texte - `pptx-viewer` couvre le cycle complet : charger un fichier existant, modifier son modele de donnees structure, l'afficher avec une fidelite visuelle complete et le sauvegarder dans un fichier `.pptx` valide. Le meme moteur principal alimente des composants d'affichage integres pour **React**, **Vue 3** et **Angular**.

## Ce qu'il fait

Le SDK fournit neuf capacites principales :

1. **Analyser** les fichiers `.pptx` depuis un `ArrayBuffer` brut en un modele [`PptxData`](/guide/data-model) structure.
2. **Creer** des presentations de toutes pieces avec une API de construction fluide.
3. **Afficher** les diapositives en tant que composants React, Vue ou Angular interactifs avec une fidelite visuelle complete.
4. **Editer** les presentations par programmation ou via l'editeur WYSIWYG integre.
5. **Sauvegarder** les modifications dans un fichier `.pptx` valide (compatible aller-retour).
6. **Convertir** les presentations en Markdown avec extraction optionnelle des medias.
7. **Exporter** les diapositives en images (PNG/JPEG), SVG, PDF, GIF ou video.
8. **Collaborer** en temps reel via Yjs CRDT avec suivi de presence.
9. **Chiffrer/Dechiffrer** les fichiers PPTX proteges par mot de passe (AES-128/256).

Le moteur gere la specification OpenXML complete incluant 16 types d'elements, 187+ formes prefinies, 23 types de graphiques, SmartArt, modeles 3D, animations, transitions (incluant morphe), themes, masques de diapositives, medias incorpores, metafichiers EMF/WMF, objets OLE, encre numerique, signatures numeriques, chiffrement, preservation des macros VBA et conformite OOXML Strict.

## Les packages

Le monorepo publie six packages independants.

| Package          | Nom npm                      | Objectif                                                                                             |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Core**         | `pptx-viewer-core`           | Analyser, creer, editer, serialiser et convertir des fichiers PPTX. Independant du framework.        |
| **React**        | `pptx-react-viewer`          | Visualiseur, editeur et presentateur React avec barre d'outils, inspecteur, collaboration et export. |
| **Vue 3**        | `pptx-vue-viewer`            | Visualiseur/editeur Vue 3 construit sur le meme moteur, avec le meme ensemble de fonctionnalites.    |
| **Angular**      | `pptx-angular-viewer`        | Visualiseur/editeur Angular construit sur le meme moteur, avec le meme ensemble de fonctionnalites.  |
| **Outils / MCP** | `pptx-viewer-mcp`            | 25 fonctions d'outils PPTX, un serveur MCP pour les agents IA et le codec de collaboration Y.Doc.    |
| **Installateur** | `@christophervr/pptx-viewer` | CLI interactif qui integre le bon package de visualiseur dans votre projet.                          |

### Graphe de dependances

Les trois packages de frameworks UI s'appuient sur la couche partagee, qui s'appuie a son tour sur Core :

```
pptx-react-viewer   ┐
pptx-vue-viewer     ├── pptx-viewer-shared ── pptx-viewer-core
pptx-angular-viewer ┘                               ├── emf-converter
                                                    └── mtx-decompressor
```

## Pour qui est-il concu ?

- **Developpeurs React creant des interfaces de visualisation/edition** - utilisez [`pptx-react-viewer`](/react/). Il encapsule le moteur principal dans un composant `PowerPointViewer` qui affiche, edite, presente et exporte des diapositives pret a l'emploi.
- **Developpeurs Vue 3** - utilisez `pptx-vue-viewer`. Meme moteur et meme ensemble de fonctionnalites que la liaison React.
- **Developpeurs Angular** - utilisez `pptx-angular-viewer`. Meme histoire : meme moteur, meme ensemble de fonctionnalites.
- **Developpeurs automatisant ou incorporant PowerPoint en mode headless** - utilisez [`pptx-viewer-core`](/core/). Aucune interface, aucune dependance de framework. Fonctionne dans un onglet de navigateur, une fonction serverless, un script de construction Node.js ou un Web Worker.
- **Workflows IA / LLM** - utilisez [`pptx-viewer-mcp`](/packages/mcp). Le serveur MCP expose les 25 fonctions d'outils a tout client compatible MCP (Claude Desktop, Cursor, VS Code Copilot).

## Etapes suivantes

- [Installation](/fr/guide/installation) - installer les packages et configurer le developpement local.
- [Demarrage rapide](/fr/guide/quick-start) - flux de bout en bout pour etre rapidement productif.
- [Apercu du package Core](/core/) - le moteur d'analyse, d'edition et de serialisation.
- [Apercu du package React](/react/) - le composant visualiseur/editeur.
- [Limitations](/guide/limitations) - mises en garde importantes a lire avant d'adopter.
