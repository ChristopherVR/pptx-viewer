# pptx-viewer-shared

Framework-agnostic viewer logic shared by all five `pptx-viewer` UI bindings:

- **`pptx-react-viewer`** (React)
- **`pptx-vue-viewer`** (Vue 3)
- **`pptx-angular-viewer`** (Angular)
- **`pptx-svelte-viewer`** (Svelte 5)
- **`pptx-vanilla-viewer`** (Vanilla JavaScript)

Everything here is **pure TypeScript with no framework imports**. The goal is one
canonical copy of cross-framework logic instead of five drifting duplicates.

> **This package is private and is never published to npm** (`"private": true` in
> `package.json`). It is bundled/inlined into each binding's own published output at build time
> (see each binding's `package.json` `build` script), so `npm install pptx-viewer-shared` will
> never work and no other package should ever declare a runtime dependency on it. If you need one
> of these framework-neutral helpers (for example the slide-transition resolver/keyframes) outside
> this monorepo, reach it through the consuming binding's `internals` subpath instead:
> `pptx-react-viewer/internals`, `pptx-vue-viewer/internals`, `pptx-angular-viewer/internals`,
> `pptx-svelte-viewer/internals`, or `pptx-vanilla-viewer/internals`. Each re-exports the relevant
> surface with its shared types already inlined, so the published `.d.ts` never references this
> package (see `scripts/check-published-shared-refs.mjs`, which fails a binding's build if one
> ever does).

![One framework-neutral rendering layer feeding React, Vue, Angular, Svelte, and Vanilla JavaScript](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/shared-rendering.svg)

## What lives here

| Area          | Notes                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `theme/`      | `ViewerTheme` types, default palette, `themeToCssVars`, `defaultCssVars`                                                                                                                                                                                                                               |
| `loader/`     | Load-pipeline helpers (media/image collection, guides)                                                                                                                                                                                                                                                 |
| `render/`     | The bulk of the package: colour/gradient/pattern resolution, shape geometry and clip-paths, connector routing/styling, animation engine, table math, chart view-models, text/bullets/warp, OMML/LaTeX, visual effects, export data, collaboration (Yjs sync/merge/presence), i18n dictionary, and more |
| `smartart-3d` | Opt-in vanilla-three 3D SmartArt renderer (subpath export)                                                                                                                                                                                                                                             |
| `i18n`        | Translation dictionary + helpers (subpath export)                                                                                                                                                                                                                                                      |
| root          | Public viewer types (`CanvasSize`, `CollaborationConfig`, …) and scalar defaults                                                                                                                                                                                                                       |

When adding a feature to any binding, put the framework-agnostic logic here
first and have each binding import it (see the root `CLAUDE.md` conventions).

## Usage

```ts
import { themeToCssVars, defaultThemeColors, type ViewerTheme } from 'pptx-viewer-shared';

const theme: ViewerTheme = { colors: { primary: '#6366f1' }, radius: '0.5rem' };
const cssVars = themeToCssVars(theme); // { '--pptx-primary': '#6366f1', ... }
```

## Build

```bash
bun run build      # tsup → dist (ESM + CJS + d.ts)
bun run test       # vitest
bun run typecheck  # tsc --noEmit
```

## License

[Apache-2.0](LICENSE). Please keep the [`NOTICE`](NOTICE) file with redistributions.
