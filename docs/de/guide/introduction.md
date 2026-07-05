---
title: Was ist pptx-viewer?
description: Ein allgemeiner Uberblick uber das TypeScript-Monorepo pptx-viewer zum Analysieren, Bearbeiten, Rendern und Konvertieren von PowerPoint-Dateien mit React, Vue 3 und Angular.
---

# Was ist pptx-viewer?

`pptx-viewer` ist ein umfassendes TypeScript-Monorepo zum **Analysieren, Bearbeiten, Rendern und Konvertieren** von Microsoft-PowerPoint-Dateien (`.pptx`) - im Browser und in Node.js. Es arbeitet vollstandig im Arbeitsspeicher mit dem OpenXML-ZIP-Archiv ohne native Abhangigkeiten.

Wahrend die meisten PowerPoint-Bibliotheken nur eine Sache konnen - Folien _generieren_ oder _rendern_ oder Text _extrahieren_ - deckt `pptx-viewer` den vollstandigen Kreislauf ab: eine vorhandene Datei laden, ihr strukturiertes Datenmodell mutieren, es mit vollstandiger visueller Treue rendern und als gultige `.pptx`-Datei speichern. Derselbe Core-Engine treibt fertige Viewer-Komponenten fur **React**, **Vue 3** und **Angular** an.

## Was es macht

Das SDK bietet neun Kernfahigkeiten:

1. **Analysieren** von `.pptx`-Dateien aus einem rohen `ArrayBuffer` in ein strukturiertes [`PptxData`](/guide/data-model)-Modell.
2. **Erstellen** von Prasentation von Grund auf mit einer flussigen Builder-API.
3. **Rendern** von Folien als interaktive React-, Vue- oder Angular-Komponenten mit vollstandiger visueller Treue.
4. **Bearbeiten** von Prasentation programmatisch oder uber den integrierten WYSIWYG-Editor.
5. **Speichern** von Anderungen zuruck in eine gultige `.pptx`-Datei (roundtrip-sicher).
6. **Konvertieren** von Prasentation in Markdown mit optionaler Medienextraktion.
7. **Exportieren** von Folien als Bilder (PNG/JPEG), SVG, PDF, GIF oder Video.
8. **Zusammenarbeiten** in Echtzeit uber Yjs CRDT mit Anwesenheitsverfolgung.
9. **Verschlusseln/Entschlusseln** von passwortgeschutzten PPTX-Dateien (AES-128/256).

Der Engine verarbeitet die vollstandige OpenXML-Spezifikation einschliesslich 16 Elementtypen, 187+ voreingestellter Formen, 23 Diagrammtypen, SmartArt, 3D-Modelle, Animationen, Ubergange (einschliesslich Morph), Designs, Folienmasters, eingebettete Medien, EMF/WMF-Metadateien, OLE-Objekte, digitale Tinte, digitale Signaturen, Verschlusselung, VBA-Makro-Erhaltung und OOXML Strict-Konformitat.

## Die Pakete

Das Monorepo stellt sechs veroffentlichte Pakete bereit.

| Paket           | npm-Name                     | Zweck                                                                                                  |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Core**        | `pptx-viewer-core`           | PPTX-Dateien analysieren, erstellen, bearbeiten, serialisieren und konvertieren. Framework-unabhangig. |
| **React**       | `pptx-react-viewer`          | React-Viewer, -Editor und -Presenter mit Symbolleiste, Inspektor, Zusammenarbeit und Export.           |
| **Vue 3**       | `pptx-vue-viewer`            | Vue-3-Viewer/Editor auf demselben Engine aufgebaut, mit demselben Funktionsumfang.                     |
| **Angular**     | `pptx-angular-viewer`        | Angular-Viewer/Editor auf demselben Engine aufgebaut, mit demselben Funktionsumfang.                   |
| **Tools / MCP** | `pptx-viewer-mcp`            | 25 PPTX-Tool-Funktionen, ein MCP-Server fur KI-Agenten und der Y.Doc-Zusammenarbeit-Codec.             |
| **Installer**   | `@christophervr/pptx-viewer` | Interaktive CLI, die das richtige Viewer-Paket in Ihr Projekt einbindet.                               |

### Abhangigkeitsgraph

Alle drei UI-Framework-Pakete basieren auf der gemeinsamen Schicht, die wiederum auf Core aufbaut:

```
pptx-react-viewer   ┐
pptx-vue-viewer     ├── pptx-viewer-shared ── pptx-viewer-core
pptx-angular-viewer ┘                               ├── emf-converter
                                                    └── mtx-decompressor
```

## Fur wen ist es gedacht?

- **React-Entwickler, die Viewer/Editor-Oberflachen erstellen** - verwenden Sie [`pptx-react-viewer`](/react/). Es kapselt den Core-Engine in eine `PowerPointViewer`-Komponente, die Folien sofort rendert, bearbeitet, prasentiert und exportiert.
- **Vue-3-Entwickler** - verwenden Sie `pptx-vue-viewer`. Gleicher Engine und gleicher Funktionsumfang wie die React-Bindung.
- **Angular-Entwickler** - verwenden Sie `pptx-angular-viewer`. Gleiche Geschichte: gleicher Engine, gleicher Funktionsumfang.
- **Entwickler, die PowerPoint headless automatisieren oder einbetten** - verwenden Sie [`pptx-viewer-core`](/core/). Keine Oberflache, keine Framework-Abhangigkeit. Lauft identisch in einem Browser-Tab, einer Serverless-Funktion, einem Node.js-Build-Skript oder einem Web Worker.
- **KI / LLM-Workflows** - verwenden Sie [`pptx-viewer-mcp`](/packages/mcp). Der MCP-Server stellt alle 25 Tool-Funktionen fur jeden MCP-kompatiblen Client (Claude Desktop, Cursor, VS Code Copilot) bereit.

## Nachste Schritte

- [Installation](/de/guide/installation) - Pakete installieren und lokale Entwicklung einrichten.
- [Schnellstart](/de/guide/quick-start) - Vollstandige Ablaufe, um schnell produktiv zu werden.
- [Core-Paket-Uberblick](/core/) - der Engine zum Analysieren, Bearbeiten und Serialisieren.
- [React-Paket-Uberblick](/react/) - die Viewer/Editor-Komponente.
- [Einschrankungen](/guide/limitations) - wichtige Hinweise, die vor der Einfuhrung gelesen werden sollten.
