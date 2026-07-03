# pptx-viewer-shared

Framework-agnostic viewer logic shared by the three `pptx-viewer` UI bindings:

- **`pptx-viewer`** (React)
- **`pptx-vue-viewer`** (Vue 3)
- **`pptx-angular-viewer`** (Angular)

Everything here is **pure TypeScript with no framework imports**. The goal is one
canonical copy of cross-framework logic instead of three drifting duplicates.

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
