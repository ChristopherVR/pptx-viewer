---
title: Installation
description: Installieren Sie die pptx-viewer-Pakete von npm, richten Sie die Peer-Abhangigkeiten fur React, Vue 3 oder Angular ein, und fuhren Sie das Monorepo lokal aus.
---

# Installation

Die `pptx-viewer`-Pakete werden unabhangig voneinander auf npm veroffentlicht. Installieren Sie nur, was Sie benotigen: den frameworkunabhangigen [Core-Engine](/core/) oder eines der Framework-Viewer-Pakete.

::: tip Node-Version
Node.js **18 oder neuer** ist fur die TypeScript-Kompilierung und fur die Ausfuhrung der Pakete ausserhalb des Browsers erforderlich.
:::

## Framework wahlen

| Framework                 | Paket                 | Hinweise                                                        |
| ------------------------- | --------------------- | --------------------------------------------------------------- |
| React                     | `pptx-react-viewer`   | Vollstandig: Viewer, Editor, Prasentator, Export, Collaboration |
| Vue 3                     | `pptx-vue-viewer`     | Gleicher Engine und Funktionsumfang                             |
| Angular                   | `pptx-angular-viewer` | Gleicher Engine und Funktionsumfang                             |
| Headless (Node / Browser) | `pptx-viewer-core`    | Keine UI, keine Framework-Abhangigkeit                          |
| KI / MCP-Werkzeuge        | `pptx-viewer-mcp`     | 25 MCP-Tools + CLI + Y.Doc-Codec                                |

## Von npm installieren

### React Viewer

Die vollstandige React-Viewer/Editor-Komponente, als **`pptx-react-viewer`** veroffentlicht. Der Core-Engine ist **enthalten**, Sie mussen ihn nicht separat installieren.

::: code-group

```bash [npm]
npm install pptx-react-viewer react react-dom
```

```bash [pnpm]
pnpm add pptx-react-viewer react react-dom
```

```bash [yarn]
yarn add pptx-react-viewer react react-dom
```

```bash [bun]
bun add pptx-react-viewer react react-dom
```

:::

::: tip Weitere Peer-Abhangigkeiten
Der Viewer benotigt auch `framer-motion`, `lucide-react`, `react-icons`, `jspdf`, `jszip`, `fast-xml-parser` und `i18next`/`react-i18next` - installieren Sie die, die Sie benotigen.
:::

### Vue 3 Viewer

Die Vue-3-Viewer-Komponente, als **`pptx-vue-viewer`** veroffentlicht. Der Core-Engine ist enthalten.

::: code-group

```bash [npm]
npm install pptx-vue-viewer vue
```

```bash [pnpm]
pnpm add pptx-vue-viewer vue
```

```bash [yarn]
yarn add pptx-vue-viewer vue
```

```bash [bun]
bun add pptx-vue-viewer vue
```

:::

### Angular Viewer

Die Angular-Viewer-Komponente, als **`pptx-angular-viewer`** veroffentlicht. Der Core-Engine ist enthalten.

::: code-group

```bash [npm]
npm install pptx-angular-viewer @angular/core @angular/common
```

```bash [pnpm]
pnpm add pptx-angular-viewer @angular/core @angular/common
```

```bash [yarn]
yarn add pptx-angular-viewer @angular/core @angular/common
```

```bash [bun]
bun add pptx-angular-viewer @angular/core @angular/common
```

:::

### Core-Engine

Der frameworkunabhangige Engine zum Analysieren, Bearbeiten, Serialisieren und Konvertieren von PPTX-Dateien.

::: code-group

```bash [npm]
npm install pptx-viewer-core
```

```bash [pnpm]
pnpm add pptx-viewer-core
```

```bash [yarn]
yarn add pptx-viewer-core
```

```bash [bun]
bun add pptx-viewer-core
```

:::

### MCP-Server und Werkzeuge

25 PPTX-Manipulations-Tool-Funktionen, ein MCP-Server fur KI-Agenten und der Y.Doc-Zusammenarbeit-Codec.

::: code-group

```bash [npm]
npm install pptx-viewer-mcp
```

```bash [pnpm]
pnpm add pptx-viewer-mcp
```

```bash [yarn]
yarn add pptx-viewer-mcp
```

```bash [bun]
bun add pptx-viewer-mcp
```

:::

## Optionale Peer-Abhangigkeiten

Einige Funktionen im React-Paket werden nur aktiviert, wenn die optionalen Peers vorhanden sind.

| Funktion                    | Optionale Peers      | Hinweise                                    |
| --------------------------- | -------------------- | ------------------------------------------- |
| **3D-Modelle** (GLB/GLTF)   | `three`              | Ohne sie zeigen 3D-Elemente ihr Posterbild. |
| **Echtzeit-Zusammenarbeit** | `yjs`, `y-websocket` | Yjs CRDT mit Anwesenheitsverfolgung.        |

## Lokale Entwicklung (Monorepo klonen)

Das Monorepo verwendet **Bun** als Paketmanager. Pakete referenzieren sich gegenseitig uber das Protokoll `workspace:*`.

```bash
# Repository klonen
git clone https://github.com/ChristopherVR/pptx-viewer
cd pptx-viewer

# Alle Workspace-Abhangigkeiten installieren
bun install

# Alle Pakete bauen
bun run build

# Tests / Typprufung
bun run test
bun run typecheck
```

::: warning Build-Reihenfolge ist wichtig
Pakete mussen in der Abhangigkeitsreihenfolge gebaut werden:

```
core -> shared -> react / vue / angular
```

`bun run build` vom Repo-Root ubernimmt dies fur Sie.
:::

### Haufige Workspace-Befehle

```bash
bun run build        # Alle Pakete in Abhangigkeitsreihenfolge bauen
bun run test         # vitest uber alle Pakete ausfuhren
bun run typecheck    # Alle Pakete typprufen
bun run fmt          # Mit oxfmt formatieren
bun run lint         # Mit oxlint linten
bun run demo         # React-Demo-Dev-Server starten (Port 4173)
bun run demo:vue     # Vue-Demo-Dev-Server starten (Port 4175)
bun run demo:angular # Angular-Demo-Dev-Server starten (Port 4174)
```

## Nachste Schritte

- [Schnellstart](/de/guide/quick-start) - Prasentation erstellen, analysieren, konvertieren und anzeigen.
- [Architektur](/de/guide/architecture) - wie die Schichten zusammenpassen.
- [Einschrankungen](/de/guide/limitations) - wichtige Hinweise vor dem Produktionseinsatz.
