---
layout: home
title: pptx-viewer
hero:
  name: 'pptx-viewer'
  text: 'PowerPoint SDK fur TypeScript'
  tagline: Analysieren, erstellen, bearbeiten, rendern und konvertieren Sie .pptx-Dateien im Browser und in Node.js. Kompatibel mit React, Vue 3 und Angular. Keine nativen Abhangigkeiten.
  actions:
    - theme: brand
      text: Erste Schritte
      link: /de/guide/introduction
    - theme: brand
      text: Demo ausprobieren
      link: https://christophervr.github.io/pptx-viewer/demo/
    - theme: alt
      text: Benutzerhandbuch
      link: /user/
    - theme: alt
      text: Auf GitHub ansehen
      link: https://github.com/ChristopherVR/pptx-viewer

features:
  - icon: "\U0001F4C2"
    title: Analyse und Roundtrip
    details: Laden Sie .pptx-Dateien in ein vollstandig typisiertes PptxData-Modell und serialisieren Sie Anderungen zuruck in eine gultige Datei. Unterstutzt 16 Elementtypen, Designs, Master und OOXML Strict.
    link: /core/loading
    linkText: Laden und Analysieren
  - icon: "\U0001F3D7\uFE0F"
    title: Von Grund auf erstellen
    details: Eine fliessende Builder-API zum programmgesteuerten Erstellen von Prasentation - Text, Formen, Bilder, Tabellen, Diagramme und mehr, ohne rohes XML zu bearbeiten.
    link: /core/builder
    linkText: Die Builder-API
  - icon: "\u269B\uFE0F"
    title: React, Vue und Angular
    details: Fertige Viewer-Komponenten fur alle drei grossen Frameworks. Dieselbe Rendering-Engine betreibt alle Bindungen - HTML/CSS-Folien, volle visuelle Treue, kein Canvas.
    link: /de/guide/installation
    linkText: Framework wahlen
  - icon: "\U0001F4DD"
    title: In Markdown konvertieren
    details: Prasentation in sauberes Markdown (oder positioniertes HTML) umwandeln mit optionaler Medienextraktion, Referentennotizen und Metadaten.
    link: /core/converter
    linkText: Markdown-Konverter
  - icon: "\U0001F3A8"
    title: Getreues Rendering
    details: 187+ voreingestellte Formen, 23 Diagrammtypen, SmartArt, Animationen, Morph-Ubergange, EMF/WMF-Metadateien, eingebettete Schriften und 3D-Modelle.
    link: /guide/data-model
    linkText: Das PptxData-Modell
  - icon: "\U0001F916"
    title: MCP und KI-Werkzeuge
    details: 25 reine Tool-Funktionen, Zod-Schemas und ein MCP-Server, damit KI-Agenten (Claude, Cursor, Copilot) PPTX-Dateien lesen, schreiben und transformieren konnen.
    link: /packages/mcp
    linkText: MCP und Werkzeuge
  - icon: "\U0001F91D"
    title: Zusammenarbeit und Verschlusselung
    details: Echtzeit-Co-Editing uber Yjs CRDT mit Anwesenheitsverfolgung. AES-128/256-Verschlusselung fur passwortgeschutzte Dateien.
    link: /react/collaboration
    linkText: Zusammenarbeit
  - icon: "\U0001F680"
    title: Alles exportieren
    details: PNG-, JPEG-, SVG-, PDF-, GIF- und Videoexport aus dem Browser. SVG-Export funktioniert auch headless in Node.js.
    link: /react/export
    linkText: Exportoptionen
---

<div style="max-width: 1152px; margin: 3rem auto 0; padding: 0 24px;">

## Ihren Technologie-Stack wahlen

Die UI-Pakete **bundeln den Core-Engine**, Sie installieren also genau ein Paket:

| Ich entwickle...              | Installieren                | Was Sie erhalten                                                           |
| ----------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| **React-App**                 | `npm i pptx-react-viewer`   | Viewer + WYSIWYG-Editor, Prasentiermodus, Export, Zusammenarbeit           |
| **Vue-3-App**                 | `npm i pptx-vue-viewer`     | Dasselbe Funktionsset, auf demselben Motor aufgebaut                       |
| **Angular-App**               | `npm i pptx-angular-viewer` | Dasselbe Funktionsset, auf demselben Motor aufgebaut                       |
| **Headless (Node / Browser)** | `npm i pptx-viewer-core`    | Analysieren, erstellen, bearbeiten, konvertieren, verschlusseln - keine UI |
| **KI / MCP-Werkzeuge**        | `npm i pptx-viewer-mcp`     | 25 MCP-Tools, CLI, Y.Doc-Zusammenarbeit-Codec                              |

Nicht sicher? `npx @christophervr/pptx-viewer` fuhrt Sie interaktiv durch die Auswahl.

</div>
