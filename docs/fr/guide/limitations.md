---
title: Limitations
description: Ce qui n'est pas supporte dans le moteur principal et les liaisons de visualiseur - a lire avant d'adopter la bibliotheque.
---

# Limitations

::: warning A lire avant d'adopter
`pptx-viewer` couvre une grande surface de la specification OpenXML, mais certaines choses sont approximees ou en lecture seule. Cette page liste uniquement ce que vous **ne pouvez pas** faire.
:::

## Moteur principal (`pptx-viewer-core`)

- **Les objets OLE sont en lecture seule.** Le contenu Excel/Word integre s'affiche comme son image d'apercu et peut etre telecharge, mais ne peut pas etre edite en place.
- **La mise en page SmartArt peut etre approximative.** Les diagrammes sont decomposes en formes positionnees. Lorsqu'un fichier contient les donnees de dessin precompilees de PowerPoint, cette mise en page exacte est utilisee ; sinon, un moteur de mise en page algorithmique l'approxime.

Tout le reste fait l'aller-retour : texte et modifications structurelles SmartArt, donnees et mise en forme de graphiques, et fichiers OOXML Strict survivent au chargement, a l'edition et a la sauvegarde.

## Visualiseurs de framework (React, Vue 3, Angular)

::: warning Le rendu CSS echange certains effets visuels contre de la fidelite ailleurs
Les diapositives sont rendues en HTML/CSS plutot qu'en Canvas, ce qui donne un texte net a n'importe quel zoom. La contrepartie : `backdrop-filter` devient un fond semi-transparent, `mix-blend-mode` se mappe sur des alternatives d'opacite, les transformations CSS 3D s'aplatissent en 2D, et les degrades de chemin s'approximent en radiaux elliptiques.
:::

- **Polices** - le texte utilise les polices disponibles dans le navigateur ; les polices manquantes reviennent aux valeurs par defaut du systeme.
- **Codecs media** - la lecture audio/video depend du support des codecs du navigateur.
- **Transitions morph** - les elements sans equivalent sur la diapositive suivante effectuent un fondu enchaene.
- **Les graphiques ne sont pas directement manipulables** - les graphiques s'affichent en SVG statique et sont edites via le panneau d'inspection.
- **Fidelite d'export raster** - l'export PNG/JPEG/PDF utilise `html2canvas`, qui ne peut pas reproduire `backdrop-filter`, les proprietes CSS personnalisees ou les transformations CSS 3D.
- **Ecrans de petite taille** - l'interface s'adapte jusqu'aux telephones d'environ 360 px, mais les panneaux les plus denses en donnees sont mieux sur une tablette ou plus grand.
- **Les modeles 3D necessitent `three`** - les elements GLB/GLTF necessitent la dependance optionnelle `three` ; sans elle, ils reviennent a une image d'affiche.
- **Collaboration** - les modifications concurrentes sur la _meme_ serie de texte sont resolues par dernier ecrivain gagnant.

## Metafichiers EMF/WMF (`emf-converter`)

::: warning API Canvas requise
La conversion de metafichiers necessite `OffscreenCanvas` ou `HTMLCanvasElement`. Node.js pur sans polyfill canvas n'est pas supporte.
:::

- **Les degrades sont simplifies** - les degrades lineaires et de chemin GDI+ s'affichent avec leur couleur principale uniquement.
- **Pas d'operations raster** - les modes de melange GDI ROP ne sont pas appliques.
- **Ecrerage limite** - ecrerage a chemin unique uniquement.
- **Rendu de police** - le texte utilise le moteur de police du navigateur.

## Lectures connexes

- [Introduction](/fr/guide/introduction) - ce que le projet supporte globalement.
- [Architecture](/fr/guide/architecture) - pourquoi ces compromis existent.
