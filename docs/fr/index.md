---
layout: home
title: pptx-viewer
hero:
  name: 'pptx-viewer'
  text: 'SDK PowerPoint pour TypeScript'
  tagline: Analysez, creez, editez, affichez et convertissez des fichiers .pptx dans le navigateur et Node.js. Compatible React, Vue 3 et Angular. Aucune dependance native.
  actions:
    - theme: brand
      text: Demarrer
      link: /fr/guide/introduction
    - theme: brand
      text: Essayer la demo
      link: https://christophervr.github.io/pptx-viewer/demo/
    - theme: alt
      text: Guide utilisateur
      link: /user/
    - theme: alt
      text: Voir sur GitHub
      link: https://github.com/ChristopherVR/pptx-viewer

features:
  - icon: "\U0001F4C2"
    title: Analyse et aller-retour
    details: Chargez des fichiers .pptx dans un modele PptxData entierement type et serialisez les modifications dans un fichier valide. Gere 16 types d'elements, themes, masques, mises en page et conformite OOXML Strict.
    link: /core/loading
    linkText: Chargement et analyse
  - icon: "\U0001F3D7\uFE0F"
    title: Construction depuis zero
    details: Une API de construction fluide pour creer des presentations par programmation - texte, formes, images, tableaux, graphiques et plus, sans toucher au XML brut.
    link: /core/builder
    linkText: L'API Builder
  - icon: "\u269B\uFE0F"
    title: React, Vue et Angular
    details: Composants d'affichage integres pour les trois grands frameworks. Le meme moteur de rendu alimente toutes les liaisons - diapositives HTML/CSS, fidelite visuelle complete, pas de Canvas.
    link: /fr/guide/installation
    linkText: Choisir un framework
  - icon: "\U0001F4DD"
    title: Conversion en Markdown
    details: Transformez des presentations en Markdown propre (ou HTML positionne) avec extraction optionnelle des medias, notes du presentateur et metadonnees.
    link: /core/converter
    linkText: Convertisseur Markdown
  - icon: "\U0001F3A8"
    title: Rendu fidele
    details: 187+ formes prefinies, 23 types de graphiques, SmartArt, animations, transitions morphe, metafichiers EMF/WMF, polices incorporees et modeles 3D - rendus avec HTML, CSS et SVG.
    link: /guide/concepts
    linkText: Concepts fondamentaux
  - icon: "\U0001F916"
    title: Outils MCP et IA
    details: 25 fonctions d'outils pures, schemas Zod et un serveur MCP pour que les agents IA (Claude, Cursor, Copilot) puissent lire, ecrire et transformer des fichiers PPTX.
    link: /packages/mcp
    linkText: MCP et outils
  - icon: "\U0001F91D"
    title: Collaboration et chiffrement
    details: Coedition en temps reel via Yjs CRDT avec suivi de presence. Chiffrement AES-128/256 pour les fichiers proteges par mot de passe.
    link: /react/collaboration
    linkText: Collaboration
  - icon: "\U0001F680"
    title: Tout exporter
    details: Export PNG, JPEG, SVG, PDF, GIF et video depuis le navigateur. L'export SVG fonctionne egalement en mode headless dans Node.js.
    link: /react/export
    linkText: Options d'export
---

<div style="max-width: 1152px; margin: 3rem auto 0; padding: 0 24px;">

## Choisir votre environnement

Les packages UI **incluent le moteur principal**, vous n'installez donc qu'un seul package :

| Je construis...                  | Installer                   | Ce que vous obtenez                                                               |
| -------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| **Application React**            | `npm i pptx-react-viewer`   | Visualiseur + editeur WYSIWYG, mode presentateur, export, collaboration           |
| **Application Vue 3**            | `npm i pptx-vue-viewer`     | Le meme ensemble de fonctionnalites, base sur le meme moteur                      |
| **Application Angular**          | `npm i pptx-angular-viewer` | Le meme ensemble de fonctionnalites, base sur le meme moteur                      |
| **Headless (Node / navigateur)** | `npm i pptx-viewer-core`    | Analyser, creer, editer, convertir, chiffrer - sans UI ni dependance de framework |
| **Outils IA / MCP**              | `npm i pptx-viewer-mcp`     | 25 outils MCP, CLI, codec de collaboration Y.Doc                                  |

Pas certain du choix ? `npx @christophervr/pptx-viewer` vous guide interactivement.

</div>
