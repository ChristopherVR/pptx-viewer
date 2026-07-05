---
title: Architektur
description: Wie die Schichten von pptx-viewer zusammenpassen - die Ladepipeline, Mixin-Komposition und CSS-Rendering der Viewer-Komponenten.
---

# Architektur

Diese Seite erklart, wie die Schichten von `pptx-viewer` zusammenpassen.

## Schichtenubersicht

```
Framework viewers (React / Vue / Angular)
         │
pptx-viewer-shared      ← framework-unabhangige Render-Logik
         │
pptx-viewer-core        ← Engine: Analyse, Bearbeitung, Serialisierung
    ├── emf-converter   ← EMF/WMF-Metadateien → PNG
    └── mtx-decompressor ← MicroType Express-Schriften
```

## Das Core-Paket

Das Core-Paket (`pptx-viewer-core`) ist ein reiner TypeScript-Engine, der in jeder JavaScript-Umgebung lauft.

### Ladepipeline

1. Der Aufrufer ubergibt einen `ArrayBuffer` an `handler.load(buffer)`.
2. JSZip entpackt das OpenXML-ZIP-Archiv.
3. fast-xml-parser analysiert das XML der Teile.
4. Parsing-Module bauen ein strukturiertes `PptxData` auf.
5. Designs, Master und Layouts werden aufgelost und angehangt.

### Speicherpipeline

1. Geanderte Folien werden in OpenXML-XML serialisiert.
2. Beziehungen und Inhaltstypen werden neu aufgebaut.
3. JSZip verpackt alles in ein `Uint8Array`.

## Die Viewer-Pakete

Jedes Viewer-Paket (React, Vue, Angular) enthalt:

- **Rendering-Komponenten** - konvertieren `PptxElement` in HTML/CSS/SVG.
- **Reaktiver Zustand** - Verwaltung von Auswahl, Zoom, Bearbeitungsverlauf.
- **Hooks/Composables** - exponiert Viewer-Operationen (React: 67+ benutzerdefinierte Hooks).
- **Symbolleiste** - das Office-Menüband in Tailwind CSS.

## CSS-Rendering

Folien werden als HTML und CSS gerendert, nicht als Canvas. Das ergibt:

- Scharfen Text bei jedem Zoom.
- Native Zugangsfahigkeit (Textauswahl, Bildschirmlesegerate).
- DOM-Interaktivitat.

Der Kompromiss ist in den [Einschrankungen](/de/guide/limitations) dokumentiert.

## Weiterfuhrend

- [Grundlegende Konzepte](/de/guide/concepts)
- [Das PptxData-Modell](/de/guide/data-model)
