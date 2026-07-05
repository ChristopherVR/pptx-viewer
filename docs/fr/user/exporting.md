---
title: Exporter
description: Enregistrez et exportez votre presentation en PNG, PDF, GIF, video, en .pptx, et plus.
---

# Exporter

Vous pouvez exporter la diapositive actuelle ou l'ensemble de la presentation dans plusieurs formats. Les actions d'exportation se trouvent dans l'onglet **Fichier** de la barre d'outils.

## Formats disponibles

| Format                      | Ce que vous obtenez                                         | Portee               |
| --------------------------- | ----------------------------------------------------------- | -------------------- |
| **Image PNG**               | Une image raster de la diapositive actuelle.                | Diapositive actuelle |
| **Copier en tant qu'image** | Copie la diapositive dans votre presse-papiers.             | Diapositive actuelle |
| **PDF**                     | Un PDF multi-pages, une diapositive par page.               | Deck entier          |
| **GIF**                     | Un GIF anime qui parcourt les diapositives.                 | Deck entier          |
| **Video**                   | Un video `.webm` qui parcourt les diapositives.             | Deck entier          |
| **Enregistrer en PPTX**     | Un fichier PowerPoint standard contenant vos modifications. | Deck entier          |
| **Enregistrer en PPSX**     | Un fichier de diaporama PowerPoint.                         | Deck entier          |
| **Enregistrer en PPTM**     | Un fichier PowerPoint avec macros.                          | Deck entier          |

::: tip Export SVG
Un chemin d'exportation vectoriel **SVG** est egalement disponible. Etant base sur des vecteurs, il evite les limites de rasterisation.
:::

## Comment exporter

1. Ouvrez l'onglet **Fichier** de la barre d'outils.
2. Choisissez **Exporter** et selectionnez un format.
3. Pour les formats de deck entier (PDF, GIF, video), une **boite de dialogue de progression** apparait.
4. Le fichier termine est telecharge automatiquement.

## Notes sur la fidelite

::: warning Les exports raster sont une approximation
PNG, JPEG, PDF, GIF et les exports video rasterisent le HTML/CSS en utilisant `html2canvas`. Certaines fonctionnalites CSS ne sont pas entierement prises en charge (par exemple `backdrop-filter`). Pour la sortie la plus fidele, preferez l'export **SVG**.
:::

## Suite

- [Collaboration](/fr/user/collaboration)
