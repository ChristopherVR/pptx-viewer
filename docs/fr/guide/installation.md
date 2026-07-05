---
title: Installation
description: Installez les packages pptx-viewer depuis npm, configurez les dependances pour React, Vue 3 ou Angular, et executez le monorepo localement.
---

# Installation

Les packages `pptx-viewer` sont publies independamment sur npm. Installez uniquement ce dont vous avez besoin : le [moteur principal](/core/) independant du framework ou l'un des packages de visualiseur.

::: tip Version Node
Node.js **18 ou superieur** est requis pour la compilation TypeScript et pour executer les packages en dehors du navigateur.
:::

## Choisir votre framework

| Framework                    | Package               | Notes                                                        |
| ---------------------------- | --------------------- | ------------------------------------------------------------ |
| React                        | `pptx-react-viewer`   | Complet : visualiseur, editeur, presentateur, export, collab |
| Vue 3                        | `pptx-vue-viewer`     | Meme moteur et meme ensemble de fonctionnalites              |
| Angular                      | `pptx-angular-viewer` | Meme moteur et meme ensemble de fonctionnalites              |
| Headless (Node / navigateur) | `pptx-viewer-core`    | Aucune interface, aucune dependance de framework             |
| Outils IA / MCP              | `pptx-viewer-mcp`     | 25 outils MCP + CLI + codec Y.Doc                            |

## Installation depuis npm

### Visualiseur React

Le composant visualiseur/editeur React complet, publie sous **`pptx-react-viewer`**. Le moteur principal est **integre**, vous n'avez pas a l'installer separement.

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

::: tip Autres dependances
Le visualiseur necessite egalement `framer-motion`, `lucide-react`, `react-icons`, `jspdf`, `jszip`, `fast-xml-parser` et `i18next`/`react-i18next` - installez ceux dont vous avez besoin.
:::

### Visualiseur Vue 3

Le composant Vue 3, publie sous **`pptx-vue-viewer`**. Le moteur principal est integre.

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

### Visualiseur Angular

Le composant Angular, publie sous **`pptx-angular-viewer`**. Le moteur principal est integre.

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

### Moteur principal

Le moteur independant du framework pour l'analyse, l'edition, la serialisation et la conversion de fichiers PPTX.

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

### Serveur MCP et outils

25 fonctions d'outils de manipulation PPTX, un serveur MCP pour agents IA et le codec de collaboration Y.Doc.

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

## Dependances optionnelles

Certaines fonctionnalites du package React ne s'activent que lorsque leurs dependances optionnelles sont presentes.

| Fonctionnalite                  | Dependances optionnelles | Notes                                             |
| ------------------------------- | ------------------------ | ------------------------------------------------- |
| **Modeles 3D** (GLB/GLTF)       | `three`                  | Sans elles, les elements 3D affichent leur image. |
| **Collaboration en temps reel** | `yjs`, `y-websocket`     | Yjs CRDT avec suivi de presence.                  |

## Developpement local (clonage du monorepo)

Le monorepo utilise **Bun** comme gestionnaire de packages. Les packages se referencent mutuellement via le protocole `workspace:*`.

```bash
# Cloner le depot
git clone https://github.com/ChristopherVR/pptx-viewer
cd pptx-viewer

# Installer toutes les dependances
bun install

# Construire tous les packages
bun run build

# Tests et verification des types
bun run test
bun run typecheck
```

::: warning L'ordre de construction est important
Les packages doivent etre construits dans l'ordre des dependances :

```
core -> shared -> react / vue / angular
```

`bun run build` depuis la racine du depot gere cela automatiquement.
:::

### Commandes courantes

```bash
bun run build        # Construire tous les packages dans l'ordre
bun run test         # Executer vitest sur tous les packages
bun run typecheck    # Verifier les types de tous les packages
bun run fmt          # Formater avec oxfmt
bun run lint         # Linter avec oxlint
bun run demo         # Demarrer le serveur de demo React (port 4173)
bun run demo:vue     # Demarrer le serveur de demo Vue (port 4175)
bun run demo:angular # Demarrer le serveur de demo Angular (port 4174)
```

## Etapes suivantes

- [Demarrage rapide](/fr/guide/quick-start) - creer, analyser, convertir et afficher des presentations.
- [Architecture](/fr/guide/architecture) - comment les couches s'articulent.
- [Limitations](/fr/guide/limitations) - mises en garde importantes avant la mise en production.
