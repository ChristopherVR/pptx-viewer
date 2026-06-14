---
title: Development
description: Getting set up to develop pptx-viewer — prerequisites, workspace and per-package commands, build order, monorepo layout, tech stack, code conventions, and packing for npm.
---

# Development

This page covers everything you need to work on the `pptx-viewer` monorepo: how to set up your environment, the workspace command reference, the build order and why it matters, the repository layout, the tech stack, and the conventions the codebase follows.

For the bigger picture of how the packages fit together, see [Architecture](/guide/architecture).

## Getting set up

### Prerequisites

- [**Bun**](https://bun.sh/) — package manager and runtime. The repo uses Bun workspaces and `workspace:*` linking.
- **Node.js 18+** — required for TypeScript compilation and tooling.

::: tip
The repository is built and tested with Bun. While many scripts will run under other package managers, the `bun run --filter` workspace targeting used by the build and typecheck scripts relies on Bun, so install Bun before you begin.
:::

### Clone and install

```bash
git clone https://github.com/ChristopherVR/pptx-viewer.git
cd pptx-viewer

# Install all workspace dependencies (packages/* and demo)
bun install
```

A single `bun install` at the root installs dependencies for every workspace package and wires up the internal `workspace:*` links between them.

## Workspace command reference

Run these from the repository root. They operate across all workspace packages.

| Command               | What it does                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `bun install`         | Install all workspace dependencies.                                                                        |
| `bun run build`       | Build every package in dependency order (see [Build order](#build-order-and-why-it-matters)).              |
| `bun run dev`         | Watch-mode build — run per package from its directory (see [Per-package commands](#per-package-commands)). |
| `bun run test`        | Run the full test suite via `scripts/test-all.sh` (Vitest across all packages).                            |
| `bun run typecheck`   | Type-check every package (`bun run --filter '*' typecheck`).                                               |
| `bun run fmt`         | Format all files with oxfmt.                                                                               |
| `bun run fmt:check`   | Check formatting without writing — CI-safe.                                                                |
| `bun run lint`        | Lint with oxlint.                                                                                          |
| `bun run lint:fix`    | Auto-fix lint issues with oxlint.                                                                          |
| `bun run demo`        | Start the Vite demo dev server.                                                                            |
| `bun run e2e`         | Run the Playwright end-to-end tests.                                                                       |
| `bun run e2e:install` | Install the Playwright browser (`chromium`, with system deps).                                             |
| `bun run e2e:ui`      | Open the Playwright test runner in interactive UI mode.                                                    |

::: info
`bun run test` runs through `scripts/test-all.sh`, which drives Vitest across the workspace rather than invoking `vitest` directly. The end-to-end commands use Playwright; run `bun run e2e:install` once before your first `bun run e2e` to fetch the browser binary.
:::

## Per-package commands

Each package exposes its own scripts. Run them from inside the package directory:

```bash
cd packages/core && bun run build      # Build a specific package (tsup)
cd packages/core && bun run dev        # Watch mode
cd packages/core && bun run test       # Run this package's tests
cd packages/core && bun run typecheck  # Type-check this package
```

## Build order and why it matters

`bun run build` compiles packages in dependency order:

```
emf-converter → mtx-decompressor → core → react
```

::: warning
The order is **not** arbitrary. The dependency graph is `react → core → { emf-converter, mtx-decompressor }`. Each package consumes the built output of the packages below it, so a downstream package must be built before anything that imports it. Building out of order (for example, building `core` before `emf-converter`) will fail or pick up stale artifacts.
:::

The root `build` script chains the per-package builds with Bun's `--filter` so the order is enforced for you — you normally just run `bun run build` at the root.

## Monorepo structure

```
packages/
  core/             pptx-viewer-core     – Parse, create, edit, serialize PPTX (framework-agnostic)
  react/            pptx-viewer          – React viewer/editor/presenter component
  emf-converter/    emf-converter        – EMF/WMF metafile → PNG converter
  mtx-decompressor/ mtx-decompressor     – MicroType Express font decompressor
tools/                                   – Supporting tooling
demo/                                    – Vite + React demo app
```

Packages link to one another with the `workspace:*` protocol, and the Bun workspaces are declared at the repository root (`packages/*` and `demo`).

## Tech stack

| Category          | Technologies                                                         |
| ----------------- | -------------------------------------------------------------------- |
| **Language**      | TypeScript (strict mode)                                             |
| **Runtime**       | Bun (package manager), Node.js 18+                                   |
| **UI**            | React 19, Framer Motion, Tailwind CSS 4, Lucide React                |
| **Parsing**       | JSZip (ZIP), fast-xml-parser (XML)                                   |
| **Export**        | html2canvas + jsPDF (PDF), custom GIF encoder, MediaRecorder (video) |
| **3D**            | Three.js, @react-three/fiber, @react-three/drei (optional)           |
| **Collaboration** | Yjs (CRDT), y-websocket (optional)                                   |
| **Crypto**        | Web Crypto API (AES-128/256 for PPTX encryption)                     |
| **Testing**       | Vitest (unit/integration), Playwright (end-to-end)                   |
| **Formatting**    | oxfmt (from the [oxc](https://oxc.rs) toolchain)                     |
| **Linting**       | oxlint (from the [oxc](https://oxc.rs) toolchain)                    |
| **Bundler**       | tsup (ESM + CJS with `.d.ts` declarations)                           |

## Code conventions

These conventions keep the codebase consistent and are enforced (where possible) by oxfmt and oxlint.

### Mixin pattern

The core runtime is composed from 50+ focused mixin modules. Each `PptxHandlerRuntime*.ts` file adds one concern (parsing, saving, theme resolution, element processing, etc.) to `PptxHandlerRuntime`. **Add new capabilities as new mixins** rather than growing existing modules. See [Concepts](/guide/concepts) for the mixin composition model.

### Barrel exports

Every directory has an `index.ts` barrel. Import from the barrel, not from individual files:

```ts
// Good
import { PptxHandler } from '../core';

// Avoid
import { PptxHandler } from '../core/core/PptxHandler';
```

### Type narrowing via the `type` discriminant

`PptxElement` is a discriminated union. Always narrow on the `type` field — never cast:

```ts
if (element.type === 'image') {
	// element is now typed as the image element variant
	console.log(element.src);
}
```

See [Data model](/guide/data-model) for the full element union.

### EMU units

PowerPoint stores geometry in English Metric Units (EMU). Conversion constants live in `packages/core/src/core/constants.ts`:

```ts
EMU_PER_INCH = 914400;
EMU_PER_POINT = 12700;
EMU_PER_PIXEL = 9525;
```

Use these constants instead of hard-coding conversion factors.

### File naming

- **kebab-case** for utility files (`type-guards.ts`, `clip-path.ts`).
- **PascalCase** for classes and class files (`PptxHandlerRuntime.ts`).

### Colocated tests

Tests live next to the source they cover, using the `.test.ts` suffix (for example, `geometry.ts` → `geometry.test.ts`).

### No `any`

Never introduce `any`. Use concrete types, `unknown` plus narrowing, or the `XmlObject` alias for parsed fast-xml-parser output.

## Packing for npm distribution

Each publishable package has a `pack` script, surfaced at the root for convenience:

```bash
bun run pack:emf     # packages/emf-converter
bun run pack:mtx     # packages/mtx-decompressor
bun run pack:core    # packages/core
bun run pack:react   # packages/react
```

::: tip
Run `bun run build` before packing so the tarball contains freshly built `dist/` output and up-to-date `.d.ts` declarations.
:::
