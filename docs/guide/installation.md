---
title: Installation
description: Install the pptx-viewer packages from npm, set up peer dependencies, and run the monorepo locally for development.
---

# Installation

The `pptx-viewer` packages are published independently on npm. Install only what you need: the framework-agnostic [core engine](/core/), the [React viewer](/react/), or the low-level binary converters.

::: tip Node version
Node.js **18 or newer** is required for TypeScript compilation and for running the packages outside the browser.
:::

## Installing from npm

### Core engine

The framework-agnostic engine for parsing, editing, serializing, and converting PPTX files. It has only two runtime peer dependencies — `jszip` and `fast-xml-parser`.

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

### React viewer

The React-based viewer/editor component. It depends on the core engine and requires **React 19** as a peer dependency.

::: code-group

```bash [npm]
npm install pptx-viewer pptx-viewer-core react react-dom
```

```bash [pnpm]
pnpm add pptx-viewer pptx-viewer-core react react-dom
```

```bash [yarn]
yarn add pptx-viewer pptx-viewer-core react react-dom
```

```bash [bun]
bun add pptx-viewer pptx-viewer-core react react-dom
```

:::

### Low-level converters

The `emf-converter` and `mtx-decompressor` packages are pulled in transitively by the core engine, but can also be installed standalone.

::: code-group

```bash [npm]
npm install emf-converter mtx-decompressor
```

```bash [pnpm]
pnpm add emf-converter mtx-decompressor
```

```bash [yarn]
yarn add emf-converter mtx-decompressor
```

```bash [bun]
bun add emf-converter mtx-decompressor
```

:::

### MCP server and tools

Tooling and the MCP server for AI agents, plus the collaboration codec, built on the core engine.

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

| Feature                     | Optional peers                                     | Notes                                                      |
| --------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| **3D models** (GLB/GLTF)    | `three`, `@react-three/fiber`, `@react-three/drei` | Without them, 3D elements fall back to their poster image. |
| **Real-time collaboration** | `yjs`, `y-websocket`                               | Yjs CRDT with presence tracking.                           |

::: code-group

```bash [npm]
npm install three @react-three/fiber @react-three/drei yjs y-websocket
```

```bash [pnpm]
pnpm add three @react-three/fiber @react-three/drei yjs y-websocket
```

```bash [yarn]
yarn add three @react-three/fiber @react-three/drei yjs y-websocket
```

```bash [bun]
bun add three @react-three/fiber @react-three/drei yjs y-websocket
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
emf-converter → mtx-decompressor → core → react
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
bun run demo         # Start the Vite demo dev server (port 4173)
```

## Next steps

- [Quick Start](/guide/quick-start) — create, parse, convert, and render presentations.
- [Architecture](/guide/architecture) — how the layers fit together.
