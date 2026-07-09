---
title: Einschrankungen
description: Was im Core-Engine und den Viewer-Bindungen nicht unterstuzt wird - vor der Einfuhrung lesen.
---

# Einschrankungen

::: warning Vor der Einfuhrung lesen
`pptx-viewer` deckt einen grossen Teil der OpenXML-Spezifikation ab, aber einige Dinge sind approximiert oder schreibgeschutzt. Diese Seite listet nur auf, was Sie **nicht** konnen.
:::

## Core-Engine (`pptx-viewer-core`)

- **OLE-Objekte sind schreibgeschutzt.** Eingebetteter Excel/Word-Inhalt wird als Vorschaubild gerendert und kann heruntergeladen werden, aber nicht direkt bearbeitet.
- **SmartArt-Layout kann approximiert sein.** Diagramme werden in positionierte Formen zerlegt. Wenn eine Datei die vorberechneten Zeichnungsdaten von PowerPoint enthalt, wird dieses genaue Layout verwendet; andernfalls approximiert ein algorithmischer Layout-Engine es.

Alles andere rundet den Kreis: SmartArt-Text und strukturelle Bearbeitungen, Diagrammdaten und Formatierung sowie OOXML Strict-Dateien uberleben Laden, Bearbeiten und Speichern.

## Framework-Viewer (React, Vue 3, Angular)

::: warning CSS-basiertes Rendering tauscht einige visuelle Effekte gegen Fidelitat an anderer Stelle
Folien werden als HTML/CSS statt als Canvas gerendert, was scharfen Text bei jedem Zoom ergibt. Der Kompromiss: `backdrop-filter` wird ein halbtransparenter Hintergrund, `mix-blend-mode` wird auf Opazitatsalternativen abgebildet, CSS-3D-Transformationen werden auf 2D abgeflacht, und Pfaddegrades werden als elliptische Radiale approximiert.
:::

- **Schriften** - Text verwendet im Browser verfugbare Schriften; fehlende Schriften fallen auf Systemstandards zuruck.
- **Medien-Codecs** - Audio/Video-Wiedergabe hangt von der Browser-Codec-Unterstutzung ab.
- **Morph-Ubergange** - Elemente ohne Gegenstuck auf der nachsten Folie uberblenden statt zu morphen.
- **Direkte Diagramm-Manipulation hangt von der Diagrammart ab** - Balken-, Linien-, Streu- und Blasen-Datenpunkte lassen sich direkt auf der Folie ziehen, um ihre Werte zu andern (Klick wahlt einen Datenpunkt aus, Doppelklick auf den Titel benennt ihn um); Kreis-, Netz- und gestapelte Datenpunkte sind per Klick auswahlbar und werden im Inspektionsfeld bearbeitet; Karten- und 3D-Oberflachendiagramme bleiben statisches SVG.
- **Raster-Export-Treue** - PNG/JPEG/PDF-Export verwendet `html2canvas`, das `backdrop-filter`, CSS-Benutzereigenschaften oder CSS-3D-Transformationen nicht reproduzieren kann.
- **Kleine Bildschirme** - die UI passt sich bis zu etwa 360-px-Telefonen an, aber die datendichtesten Panels sind auf einem Tablet oder grosser besser.
- **3D-Modelle benotigen `three`** - GLB/GLTF-Elemente benotigen die optionale `three`-Peer-Abhangigkeit; ohne sie fallen sie auf ein Posterbild zuruck.
- **Zusammenarbeit** - gleichzeitige Bearbeitungen derselben Textreihe werden nach Letzter-schreibt-gewinnt-Prinzip aufgelost.

## EMF/WMF-Metadateien (`emf-converter`)

::: warning Canvas-API erforderlich
Die Metadatei-Konvertierung benotigt `OffscreenCanvas` oder `HTMLCanvasElement`. Reines Node.js ohne Canvas-Polyfill wird nicht unterstuzt.
:::

- **Verlaufe werden vereinfacht** - GDI+ lineare und Pfadverlaufe werden nur mit ihrer Primarfarbe gerendert.
- **Keine Rasteroperationen** - GDI-ROP-Blending-Modi werden nicht angewendet.
- **Begrenztes Clipping** - nur Einzelpfad-Clipping.

## Weiterfulhrendes

- [Einfuhrung](/de/guide/introduction) - was das Projekt generell unterstuzt.
- [Architektur](/de/guide/architecture) - warum diese Kompromisse existieren.
