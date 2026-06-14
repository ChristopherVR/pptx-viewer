# pptx-viewer-shared

Framework-agnostic viewer logic shared by the three `pptx-viewer` UI bindings:

- **`pptx-viewer`** (React)
- **`pptx-vue-viewer`** (Vue 3)
- **`pptx-angular-viewer`** (Angular)

Everything here is **pure TypeScript with no framework imports**. The goal is one
canonical copy of cross-framework logic instead of three drifting duplicates.

## What lives here

| Area                                                                                | Status | Notes                                                                         |
| ----------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `theme/` — `ViewerTheme` types, default palette, `themeToCssVars`, `defaultCssVars` | ✅     | Extracted from `packages/react/src/theme`. React/Vue now re-export from here. |
| color resolution (`color-core`, `color-gradient`, `color-patterns`)                 | ☐      | Extraction candidate                                                          |
| geometry / clip-paths (`geometry*`, `resolved-shape-clip-path`)                     | ☐      | Extraction candidate                                                          |
| connector routing (`connector-router*`)                                             | ☐      | Extraction candidate                                                          |
| animation timeline engine (`animation-*` non-JSX)                                   | ☐      | Extraction candidate                                                          |
| table-merge math, morph matching, export data helpers                               | ☐      | Extraction candidate                                                          |

See `packages/angular/PORTING.md` and `packages/vue/PORTING.md` for the full
extraction plan and the conventions every binding follows.

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
