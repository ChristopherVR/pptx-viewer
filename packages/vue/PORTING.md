# Porting `pptx-viewer` (React) → `pptx-vue-viewer` (Vue 3)

> **Living document.** Update the status tables as you port. This is the
> hand-off contract between sessions (and a reference for the parallel Angular
> port). Keep it accurate — future sessions trust it instead of re-scanning the
> 100k-line React package.

## Goal

Ship a Vue 3 package, **`pptx-vue-viewer`** (npm), that is a feature-equivalent
counterpart to the React `pptx-viewer` package (`packages/react`). Both wrap the
framework-agnostic `pptx-viewer-core` engine. The Angular port is being done in
a separate session and should follow the same conventions and the same
shared-code extraction plan (see below).

## Source-of-truth sizing (React package, non-test)

| Area                         | Files                  | Notes                                                                                                                                        |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewer/components/**/*.tsx` | 213                    | Presentational components (10 subdirs: canvas, collaboration, elements, inspector, mobile, notes, print, slide-sorter, slides-pane, toolbar) |
| `viewer/hooks/**/*.ts`       | 94                     | All business logic (React hooks)                                                                                                             |
| `viewer/utils/**/*.ts`       | 116                    | **Framework-agnostic logic** — color, geometry, connector routing, animation, latex/omml, morph, export, table-merge, etc.                   |
| `viewer/utils/**/*.tsx`      | 68                     | JSX-producing renderers (charts, smartart, table, text, shapes) — must be reimplemented per framework                                        |
| Total non-test               | ~564 files / ~101k LOC |                                                                                                                                              |

## Conventions (React → Vue 3)

Use **Vue 3.5+, `<script setup lang="ts">` SFCs, Composition API**. Mirror the
React hook architecture as composables so the two packages stay easy to keep in
sync.

| React                                         | Vue                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Custom hook `useXxx` returning values/setters | Composable `useXxx` returning `ref`/`computed`/`shallowRef`                                                    |
| `useState`                                    | `ref` / `shallowRef` (use `shallowRef` for large parsed arrays/maps)                                           |
| `useMemo`                                     | `computed`                                                                                                     |
| `useEffect(fn, [deps])`                       | `watch` / `watchEffect` (+ `onScopeDispose` for cleanup)                                                       |
| `useRef` (DOM)                                | template `ref`                                                                                                 |
| `useRef` (mutable box)                        | module-local `let` inside the composable, or `ref`                                                             |
| `createContext` + `useContext`                | `provide` / `inject` with a typed `InjectionKey`                                                               |
| `forwardRef` + `useImperativeHandle`          | `defineExpose`                                                                                                 |
| Function-prop callbacks (`onX`)               | `defineEmits` events (`@x`)                                                                                    |
| `.tsx` component                              | `.vue` SFC                                                                                                     |
| `React.memo`                                  | usually unnecessary; rely on Vue reactivity granularity                                                        |
| Tailwind utility classes                      | currently hand-written CSS scoped under `.pptx-vue-viewer` (Tailwind pipeline optional — see "Open decisions") |

## Shared-code extraction (IN PROGRESS — `packages/shared` → `pptx-viewer-shared`)

The framework-agnostic logic now has a home: **`packages/shared`** (package
name `pptx-viewer-shared`). It is **bundled, not published** — each UI binding
(React, Vue, Angular) lists it as a **devDependency** and **inlines** it into
its own `dist` (JS + `.d.ts`). The published tarballs are self-contained; npm
never sees `pptx-viewer-shared` as a dependency. `pptx-viewer-core` is treated
the same way (inlined, devDependency) so a consumer installs only the single
framework package.

How the inlining is wired:

- **React** (`packages/react`): tsup `noExternal: ['pptx-viewer-core', 'pptx-viewer-shared']`.
- **Vue** (`packages/vue`): Vite — internal packages omitted from `rollupOptions.external`
  (JS inlined); `vite-plugin-dts` with `bundledPackages: ['pptx-viewer-core', 'pptx-viewer-shared']`
  and `rollupTypes: true` (types inlined into `dist/index.d.ts` + `dist/viewer/index.d.ts`).
- **Angular** (`packages/angular`): ng-packagr **externalizes** bare-specifier
  deps and cannot inline them like tsup/vite, so the approach differs:
  `pptx-viewer-shared` is **vendored at build time** — `scripts/inline-shared.mjs`
  copies `packages/shared/src` into `src/internal/shared-src` (git-ignored) and
  the lib imports it via a relative barrel, so ng-packagr compiles it as local
  source and ships it inlined. `pptx-viewer-shared` never appears in the
  published manifest. `pptx-viewer-core` is kept an external **peerDependency**
  (it is a published package; vendoring the whole engine into the FESM is
  impractical), so an Angular consumer installs `pptx-angular-viewer` +
  `pptx-viewer-core`.

Build order: `pptx-viewer-core` → `pptx-viewer-shared` → bindings (already wired
in the root `build` script).

**Already extracted into `pptx-viewer-shared`** (Vue re-exports these for
import-path stability — see `src/theme/*`, `src/viewer/constants.ts`,
`src/viewer/composables/load-content-helpers.ts`, `src/viewer/types.ts`):

- ✅ `theme/{types,defaults,css-vars}` → `pptx-viewer-shared/theme`
- ✅ load-pipeline helpers (`collect*`, `buildInitialGuides`, `GuideEntry`,
  `ImagePathElement`) → `pptx-viewer-shared/loader`
- ✅ public types `CanvasSize`, `CollaborationConfig`, `CollaborationRole`
- ✅ scalar constants (`DEFAULT_CANVAS_*`, fallback colours)

**Still to extract** (pure `.ts`, no framework import) — priority targets:

- `utils/color-core.ts`, `color-gradient.ts`, `color-patterns.ts`, `color.ts`
- `utils/geometry.ts`, `geometry-image.ts`, `geometry-selection.ts`
- `utils/connector-router*.ts`, `connector-reroute.ts`, `connector-path` (path math)
- `utils/animation-*.ts` (timeline/sequencer/keyframes/presets — the engine, not the JSX)
- `utils/latex-to-omml*.ts`, `omml-*.ts`, `omml-to-mathml.ts`
- `utils/morph-*.ts` (matching/transition/svg-path)
- `utils/warp-path-*.ts`, `text-warp-classifier.ts`
- `utils/table-merge-core.ts`, `table-merge-utils.ts`, `table-selection-utils.ts`
- `utils/shape-adjustment.ts`, `shape-round-rect.ts`, `shape-3d-styles.ts`,
  `shape-visual-3d.ts`, `shape-visual-style.ts`, `resolved-shape-clip-path.ts`
- `utils/image-effects.ts`, `image-style.ts`, `duotone-effects.ts`,
  `effect-dag-filters.ts`, `shape-visual-effects.ts`
- `utils/export-*.ts`, `pdf-builder*.ts`, `svg-print-serializer.ts` (the data/binary parts)
- `utils/clone.ts`, `compare.ts`, `generate-id.ts`, `style.ts`, `element.ts`,
  `xml*.ts`, `hyperlink-security.ts`, `unicode-script-detection.ts`,
  `kinsoku-styles.ts`, `tab-leader.ts`, `remap-text.ts`

When porting a feature that needs one of the candidates above, **extract it into
`pptx-viewer-shared` first, then import from there** (both React and Vue). The
only Vue-local pure helper still not extracted is `element-style.ts` (a tiny
style subset) — fold its richer logic into shared when the renderer grows.

> ⚠️ Coordinate the extraction with the React + Angular sessions: moving files
> out of `packages/react` touches that package's imports. Do it as its own
> focused change, not bundled into a feature port.

## Directory mapping

```
packages/react/src/                         packages/vue/src/
  index.ts                                    index.ts                         ✅
  utils.ts (cn)                               utils.ts                         ✅
  theme/{types,defaults,css-vars}.ts          theme/{types,defaults,css-vars}.ts ✅ (copied; extract later)
  theme/context.tsx (createContext)           theme/provider.ts (provide/inject) ✅
  lib/canvas-export.ts                         lib/  (TODO)
  viewer/PowerPointViewer.tsx                  viewer/PowerPointViewer.vue      ◑ viewer-first
  viewer/index.ts                              viewer/index.ts                  ✅
  viewer/types-ui.ts / types-core.ts           viewer/types.ts                  ◑ public subset
  viewer/constants/*                           viewer/constants.ts              ◑ subset
  viewer/hooks/*                               viewer/composables/*             ◑ load only
  viewer/components/SlideCanvas.tsx            viewer/components/SlideCanvas.vue ◑ basic
  viewer/components/ElementRenderer.tsx        viewer/components/ElementRenderer.vue ◑ basic
  viewer/components/{toolbar,inspector,...}    viewer/components/*              ☐ TODO
  viewer/utils/*                               viewer/composables/element-style.ts ◑ tiny subset
  styles/pptx-viewer.css (Tailwind)            styles/pptx-vue-viewer.css       ◑ hand-written
```

Legend: ✅ done · ◑ partial/basic · ☐ not started

## Status by area

### Foundation

| Item                                                                                | Status | Notes                                                                          |
| ----------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Package scaffold (package.json `pptx-vue-viewer`, Vite lib build, tsconfig, vitest) | ✅     | Vite lib mode; `vite-plugin-dts` (rollupTypes) inlines core+shared types       |
| `cn` utility                                                                        | ✅     | verbatim                                                                       |
| Theme types/defaults/css-vars                                                       | ✅     | re-exports `pptx-viewer-shared/theme`                                          |
| Theme provider (`provide`/`inject`, `useThemeStyle`)                                | ✅     | replaces React context                                                         |
| Bundle core + shared (inlined, devDeps, not published)                              | ✅     | matches React tsup `noExternal`; verified no dangling internal imports in dist |
| Public types (props/emits/expose)                                                   | ◑      | viewer-first subset of `types-ui.ts`                                           |
| Base CSS                                                                            | ◑      | hand-written chrome; no Tailwind yet                                           |

### Load / state

| Item                                                                                                                                               | Status | Notes                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useLoadContent`                                                                                                                                   | ◑      | parses via `PptxHandler`, resolves image/media Blob URLs, exposes `getContent`. Populates **slides, canvasSize, theme, slideMasters, mediaDataUrls** only. |
| `load-content-helpers`                                                                                                                             | ✅     | verbatim (extraction candidate)                                                                                                                            |
| Full `useViewerState` (sections, customShows, embeddedFonts, header/footer, notes/handout masters, signatures, macros, guides, tags, doc props, …) | ☐      | ~25 extra fields the React hook sets; add as features need them                                                                                            |
| `useEditorHistory` (undo/redo)                                                                                                                     | ☐      |                                                                                                                                                            |
| `useEditorOperations` (element CRUD/transform)                                                                                                     | ☐      |                                                                                                                                                            |
| `useExportHandlers` / `useViewerIntegration`                                                                                                       | ☐      |                                                                                                                                                            |
| Autosave, clipboard, find/replace, comments                                                                                                        | ☐      |                                                                                                                                                            |

### Rendering

| Item                                                           | Status | Notes                                                                                                                                                                             |
| -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PowerPointViewer.vue` (load + nav + zoom)                     | ◑      | loading/error/encrypted states, prev/next, zoom, **live thumbnail previews**                                                                                                      |
| `SlideStage.vue`                                               | ◑      | reusable scaled stage (bg + elements); shared by canvas + thumbnails                                                                                                              |
| `SlideCanvas.vue`                                              | ◑      | centres `SlideStage` in a scrollable viewport; no rulers/grid/guides/overlays                                                                                                     |
| `ElementRenderer.vue`                                          | ◑      | text, shape (fill/stroke + preset clip-paths), picture/image, media poster, group recursion; placeholders for the rest. Component tests.                                          |
| `element-style.ts`                                             | ◑      | container/shape/text/image basics + gradient & image fills + **preset-geometry clip-paths** (roundRect radius / ellipse / clip-path / line / cylinder); no effects/3D             |
| `shape-geometry.ts` (clip-path cascade)                        | ◑      | mirrors React `getResolvedShapeClipPath`; imports core's evaluator/adjustment-aware/cloud/static entry points directly (no shared extraction needed — core is framework-agnostic) |
| text: `picture`/`image`                                        | ◑      | `<img>` object-fit contain                                                                                                                                                        |
| text: rich text runs (bold/italic/underline/strike/color/size) | ◑      | per-segment spans, paragraph + line breaks                                                                                                                                        |
| Connectors (SVG)                                               | ◑      | `ConnectorRenderer.vue` — straight line + arrowheads + dash; bent/curved routing, compound lines, text overlay TODO                                                               |
| Tables                                                         | ◑      | `TableRenderer.vue` + `composables/table-style.ts` — HTML `<table>`, colgroup widths/row heights, rowspan/colspan merges, per-cell fill/borders/dash/align, band/header/total emphasis, diagonal borders (SVG overlay). Read-only; pattern fills, scheme-colour band resolution, rich per-run cell text still TODO |
| Charts (SVG)                                                   | ◑      | `ChartRenderer.vue` + `chart/ChartChrome.vue` + `composables/chart-helpers.ts` — bar/column, stacked & 100%-stacked, line, area, pie/doughnut + axes/gridlines/legend/title/data-labels. Deferred (labelled placeholder): radar, scatter/bubble, stock, surface, treemap, sunburst, funnel, waterfall, combo, map, boxWhisker, histogram, ofPie; + secondary/log axes, trendlines, overlays |
| SmartArt                                                       | ☐      | `utils/smartart-*.tsx` (large)                                                                                                                                                    |
| Ink / OLE / Model3D / Zoom                                     | ☐      |                                                                                                                                                                                   |
| Image effects, gradients, shadows, glow                        | ◑      | preset-geometry **clip-paths done** (`shape-geometry.ts`); image effects/shadows/glow still TODO                                                                                  |
| Text warp / WordArt, equations (OMML→MathML)                   | ☐      |                                                                                                                                                                                   |

### Editor chrome (all ☐ — not started)

Toolbar, inspector panels (fill/stroke/text/image/table/chart/animation/…),
context menu, dialogs (share/broadcast/settings/properties/hyperlink/…),
slides pane, slide sorter, notes, mobile chrome, accessibility panel.

### Advanced subsystems (all ☐ — not started)

Presentation mode + animations/transitions, export (PNG/PDF/GIF/video,
html2canvas equivalent — note React uses `html2canvas-pro`; Vue will need an
equivalent rasterizer), collaboration (Yjs), print, find/replace, comments,
digital signatures, font embedding/injection.

## Open decisions / notes for next session

1. **Styling strategy.** React uses Tailwind 4 utility classes compiled to
   `pptx-viewer.css`. Options for Vue: (a) adopt the same Tailwind pipeline
   (`@tailwindcss/cli` is already a devDep) and reuse class names, easing 1:1
   component porting; or (b) continue hand-written scoped CSS. Recommend (a)
   once the editor chrome porting begins — it makes the 213 components far
   cheaper to port. Decide before porting the toolbar/inspector.
2. **Rasterizer for export.** `html2canvas-pro` is React-agnostic (operates on
   DOM), so it can likely be reused directly for the Vue export path.
3. **Collaboration.** Yjs/y-websocket are framework-agnostic; the React
   `hooks/collaboration/*` logic is a good extraction candidate. The Vue
   binding only needs reactive wrappers + cursor overlay components.
4. **Demo.** No Vue demo app yet. Consider `demo-vue/` (Vite + Vue) mirroring
   `demo/`, or a route in the existing demo.
5. **Tests.** Logic composables should get vitest unit tests (happy-dom env is
   configured). Component tests via `@vue/test-utils`.

## Recommended next steps (priority order)

1. Add a Vue demo page that loads a sample `.pptx` to validate rendering visually. (demo-vue done.)
2. Flesh out `ElementRenderer.vue`: ~~clip-paths for preset geometries~~ ✅ (done —
   `shape-geometry.ts` imports the cascade straight from `pptx-viewer-core`; no
   `pptx-viewer-shared` extraction was needed because core's geometry layer is
   already framework-agnostic), ~~connectors (SVG)~~ ✅, then **tables**, then charts.
   (Gradient + image fills done.)
3. Decide the Tailwind question before starting the toolbar/inspector.
4. Port `useViewerState` fully + `useEditorHistory` to unlock editing.
5. Continue the shared-code extraction (color → ~~geometry~~ (lives in core
   already) → connector-router → animation engine), importing from
   `pptx-viewer-shared`/`pptx-viewer-core` in both React and Vue.

> **Note for the extraction roadmap:** the PORTING plan assumed shape-path
> generation lived in `packages/react/src/viewer/utils/geometry.ts` and needed
> hoisting to `pptx-viewer-shared`. It doesn't — the ECMA-376 preset evaluator,
> adjustment-aware table, cubic-Bezier cloud paths, and static preset table all
> already live in **`pptx-viewer-core`** (`getShapeClipPathFromPreset`,
> `getAdjustmentAwareShapeClipPath`, `getCloudPathForRendering`,
> `getShapeClipPath`, `getShapeType`, `getRoundRectRadiusPx`) and are exported
> from its barrel. Bindings should import these directly. React keeps a local
> `shape-types.tsx` polygon fallback, but Vue/Angular don't need to replicate it.

## Session log

- **2026-06-14** — Initial scaffold. Package config (Vite lib build, two entry
  points, Vue 3.5 peer dep), foundation (cn, theme system as provide/inject +
  `useThemeStyle`, public prop/emit/expose types, constants subset),
  `useLoadContent` composable (parse + Blob URL resolution + `getContent`),
  basic `PowerPointViewer.vue` / `SlideCanvas.vue` / `ElementRenderer.vue`
  (text/shape/image/group + placeholders), base CSS, unit tests for theme
  css-vars and element-style, README. Documented shared-code extraction plan.
- **2026-06-14** — `pptx-viewer-shared` (`packages/shared`) introduced as the
  bundled-not-published home for framework-agnostic logic; theme, loader
  helpers, public types, and scalar constants moved there (Vue re-exports for
  path stability). Switched the Vue build to inline both `pptx-viewer-core` and
  `pptx-viewer-shared` (JS via Rollup, types via `vite-plugin-dts`
  `bundledPackages` + `rollupTypes`); both are now devDependencies. Verified the
  published `dist` has no dangling internal imports. Build/typecheck/test/lint/fmt green.
- **2026-06-14** — Renderer fidelity + thumbnails. Extracted reusable
  `SlideStage.vue` (scaled bg + element list) shared by `SlideCanvas` and the
  thumbnail rail, so the rail now shows **live mini-slide previews** instead of
  numbers. Added gradient (`fillGradient`) and image (`fillImageUrl`) fill
  resolution to `element-style.ts` (mirrors React's fill order). Added
  `ElementRenderer` component tests (`@vue/test-utils`): text, rich-text runs,
  picture, group recursion, placeholder. 15 tests green.
- **2026-06-14** — Changelog tooling: `cliff.toml` (git-cliff) + root
  `changelog*` scripts + CI release-job integration (regenerate CHANGELOG.md,
  commit back, release notes); CLAUDE.md documents Conventional Commits.
- **2026-06-14** — `demo-vue/` (Vite + Vue 3, port 4175) mirroring the React
  `demo/`: drag-drop / picker / new-presentation, theme switcher, download via
  `getContent()`. Browser smoke test passed. Registered as a workspace.
- **2026-06-14** — Connectors: `ConnectorRenderer.vue` renders straight
  connectors/lines as SVG (stroke colour/width/dash, start/end arrowheads,
  flip-aware endpoints); `ElementRenderer` delegates `type === 'connector'`.
  4 connector tests added (19 total green). Bent/curved routing still TODO.
- **2026-06-15** — Preset-geometry clip-paths. Added `shape-geometry.ts`
  (`getResolvedShapeClipPath` / `getResolvedShapeClipPathFor`) mirroring the
  React `resolved-shape-clip-path.ts` cascade — adjustment-aware → ECMA-376
  preset evaluator → cubic-Bezier cloud → static preset table — importing all
  four entry points **directly from `pptx-viewer-core`** (the geometry layer is
  already framework-agnostic; no `pptx-viewer-shared` extraction needed, contra
  the original roadmap). Rewrote `getShapeFillStrokeStyle` to follow React's
  `getShapeVisualStyle` geometry priority: connector → roundRect (radius via
  `getRoundRectRadiusPx`) → ellipse (`9999px`) → clip-path → line (bare top
  edge) → cylinder (`48% / 12%`); replaced the crude `borderRadius` guesses.
  Added a `cssBorderDashStyle` helper for dashed/dotted borders. 13 new tests
  (32 total green). Build inlines core geometry (bundle externalises only
  `vue`/`jszip`/`fast-xml-parser`); typecheck/lint/fmt clean.
- **2026-06-15** — Tables + Charts (parallel subagent port). **Tables:**
  `TableRenderer.vue` + `composables/table-style.ts` render the structured
  `PptxTableData` model as an HTML `<table>` — colgroup widths, row heights,
  rowspan/colspan with merge-skip, per-cell fill/borders/dash/alignment/vertical
  direction/padding, band/header/total-row & first/last-column emphasis, and
  diagonal borders via an SVG overlay. Read-only (no resize/inline-edit/select);
  pattern fills, theme-scheme band colours, and rich per-run cell text deferred.
  **Charts:** `ChartRenderer.vue` + `chart/ChartChrome.vue` +
  `composables/chart-helpers.ts` render SVG for bar/column, stacked &
  100%-stacked, line, area, pie/doughnut with axes, gridlines, zero line,
  legend, title, and data labels. Exotic types (radar, scatter/bubble, stock,
  surface, treemap, sunburst, funnel, waterfall, combo, map, boxWhisker,
  histogram, ofPie) + secondary/log axes, trendlines, and overlays render a
  labelled `Chart: <type>` placeholder (TODO comments in place). `ElementRenderer`
  now delegates `type === 'table'` / `'chart'`; both exported from the viewer
  barrel. 22 new tests (41 total green); typecheck/lint clean; build green.
  Done via two `general-purpose` subagents working disjoint files in parallel,
  integrated + committed centrally.
