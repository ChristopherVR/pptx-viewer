---
title: Installation
description: Install the pptx-viewer packages from npm, set up peer dependencies for React, Vue 3, or Angular, and run the monorepo locally for development.
---

# Installation

The `pptx-viewer` packages are published independently on npm. Install only what you need: the framework-agnostic [core engine](/core/) or one of the framework viewer packages.

::: tip Node version
Node.js **18 or newer** is required for TypeScript compilation and for running the packages outside the browser.
:::

## Choose your framework

| Framework                 | Package               | Notes                                                           |
| ------------------------- | --------------------- | --------------------------------------------------------------- |
| React                     | `pptx-react-viewer`   | Full-featured: viewer, editor, presenter, export, collaboration |
| Vue 3                     | `pptx-vue-viewer`     | Same engine and feature set as the React binding                |
| Angular                   | `pptx-angular-viewer` | Same engine and feature set as the React binding                |
| Headless (Node / browser) | `pptx-viewer-core`    | No UI, no framework dependency                                  |
| AI / MCP tooling          | `pptx-viewer-mcp`     | 51 MCP tools + CLI + Y.Doc codec                                |

## Installing from npm

### React viewer

The full-featured React viewer/editor component, published as **`pptx-react-viewer`**. The core engine is **bundled in**, so you don't install it separately.

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

::: tip Other peer dependencies
The viewer also expects `framer-motion`, `lucide-react`, `react-icons`, `jspdf`, `jszip`, `fast-xml-parser`, and `i18next`/`react-i18next` - install the ones your usage needs.
:::

### Vue 3 viewer

The Vue 3 viewer component, published as **`pptx-vue-viewer`**. The core engine is bundled in.

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

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PowerPointViewer } from 'pptx-vue-viewer';

const content = ref<ArrayBuffer | null>(null);
</script>

<template>
	<PowerPointViewer :content="content" />
</template>
```

### Angular viewer

The Angular viewer component, published as **`pptx-angular-viewer`**. The core engine is bundled in.

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

```typescript
// app.module.ts
import { PptxAngularViewerModule } from 'pptx-angular-viewer';

@NgModule({
	imports: [PptxAngularViewerModule],
})
export class AppModule {}
```

```html
<!-- app.component.html -->
<pptx-viewer [content]="content"></pptx-viewer>
```

### Core engine

The framework-agnostic engine for parsing, editing, serializing, and converting PPTX files. Use this when you need headless automation, build scripts, or Node.js pipelines with no UI dependency. The UI packages above bundle the core engine, so you don't need to install it separately if you're already using one of them.

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

### MCP server and tools

25 PPTX manipulation tool functions, an MCP server for AI agents, and the Y.Doc collaboration codec - all built on the core engine.

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

## Optional peer dependencies

Some features in the React package activate only when their optional peers are present.

| Feature                     | Optional peers       | Notes                                                      |
| --------------------------- | -------------------- | ---------------------------------------------------------- |
| **3D models** (GLB/GLTF)    | `three`              | Without them, 3D elements fall back to their poster image. |
| **Real-time collaboration** | `yjs`, `y-websocket` | Yjs CRDT with presence tracking.                           |

::: code-group

```bash [npm]
npm install three yjs y-websocket
```

```bash [pnpm]
pnpm add three yjs y-websocket
```

```bash [yarn]
yarn add three yjs y-websocket
```

```bash [bun]
bun add three yjs y-websocket
```

:::

## Local development (cloning the monorepo)

The monorepo uses **Bun** as its package manager and workspace runner. Packages reference each other through the `workspace:*` protocol.

```bash
# Clone the repository
git clone https://github.com/ChristopherVR/pptx-viewer
cd pptx-viewer

# Install all workspace dependencies
bun install

# Build all packages
bun run build

# Run tests / type-check
bun run test
bun run typecheck
```

::: warning Build order matters
Packages must be built in dependency order:

```
core -> shared -> react / vue / angular
```

`bun run build` from the repo root handles this for you. When building a single package manually (`cd packages/<pkg> && bun run build`), make sure its dependencies are built first.
:::

### Common workspace commands

```bash
bun run build        # Build all packages in dependency order
bun run test         # Run vitest across all packages
bun run typecheck    # Type-check all packages
bun run fmt          # Format with oxfmt
bun run lint         # Lint with oxlint
bun run demo         # Start the React demo dev server (port 4173)
bun run demo:vue     # Start the Vue demo dev server (port 4175)
bun run demo:angular # Start the Angular demo dev server (port 4174)
```

## Next steps

- [Quick Start](/guide/quick-start) - create, parse, convert, and render presentations.
- [Architecture](/guide/architecture) - how the layers fit together.
- [Limitations](/guide/limitations) - important caveats before going to production.
