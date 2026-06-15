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

| Item                                                                                                                                               | Status | Notes                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useLoadContent`                                                                                                                                   | ◑      | parses via `PptxHandler`, resolves image/media Blob URLs, exposes `getContent`. Populates **slides, canvasSize, theme, slideMasters, mediaDataUrls** only.                                                                                                                 |
| `load-content-helpers`                                                                                                                             | ✅     | verbatim (extraction candidate)                                                                                                                                                                                                                                            |
| Full `useViewerState` (sections, customShows, embeddedFonts, header/footer, notes/handout masters, signatures, macros, guides, tags, doc props, …) | ☐      | ~25 extra fields the React hook sets; add as features need them                                                                                                                                                                                                            |
| `useEditorHistory` (undo/redo)                                                                                                                     | ◑      | `composables/useEditorHistory.ts` — undo/redo over `Ref<PptxSlide[]>` (deep-clone snapshots, 120 cap). **Wired into `PowerPointViewer`** (toolbar + Ctrl+Z/Y)                                                                                                              |
| `useEditorOperations` (element CRUD/transform)                                                                                                     | ◑      | `composables/useEditorOperations.ts` — add/update/remove/transform/duplicate/reorder/updateText over the active slide via core clone helpers; snapshot-first history. **Wired into `PowerPointViewer`** (toolbar + selection overlay). Group/align/flip/clipboard deferred |
| `useExportHandlers` / `useViewerIntegration`                                                                                                       | ☐      |                                                                                                                                                                                                                                                                            |
| Clipboard, find/replace                                                                                                                            | ◑      | clipboard (cut/copy/paste via context menu) + `useFindReplace`/`FindReplaceBar` (Ctrl+F, cross-slide text search + replace/replace-all, history-aware). Autosave + comments still ☐                                                                                        |

### Rendering

| Item                                                           | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PowerPointViewer.vue` (load + nav + zoom)                     | ◑      | loading/error/encrypted states, prev/next, zoom, **live thumbnail previews**                                                                                                                                                                                                                                                                                                                |
| `SlideStage.vue`                                               | ◑      | reusable scaled stage (bg + elements); shared by canvas + thumbnails                                                                                                                                                                                                                                                                                                                        |
| `SlideCanvas.vue`                                              | ◑      | centres `SlideStage` in a scrollable viewport; no rulers/grid/guides/overlays                                                                                                                                                                                                                                                                                                               |
| `ElementRenderer.vue`                                          | ◑      | text, shape (fill/stroke + preset clip-paths), picture/image, media poster, group recursion; placeholders for the rest. Component tests.                                                                                                                                                                                                                                                    |
| `element-style.ts`                                             | ◑      | container/shape/text/image basics + gradient & image fills + **preset-geometry clip-paths** (roundRect radius / ellipse / clip-path / line / cylinder); no effects/3D                                                                                                                                                                                                                       |
| `shape-geometry.ts` (clip-path cascade)                        | ◑      | mirrors React `getResolvedShapeClipPath`; imports core's evaluator/adjustment-aware/cloud/static entry points directly (no shared extraction needed — core is framework-agnostic)                                                                                                                                                                                                           |
| text: `picture`/`image`                                        | ◑      | `<img>` object-fit contain                                                                                                                                                                                                                                                                                                                                                                  |
| text: rich text runs (bold/italic/underline/strike/color/size) | ◑      | per-segment spans, paragraph + line breaks                                                                                                                                                                                                                                                                                                                                                  |
| Connectors (SVG)                                               | ◑      | `ConnectorRenderer.vue` — straight line + arrowheads + dash; bent/curved routing, compound lines, text overlay TODO                                                                                                                                                                                                                                                                         |
| Tables                                                         | ◑      | `TableRenderer.vue` + `composables/table-style.ts` — HTML `<table>`, colgroup widths/row heights, rowspan/colspan merges, per-cell fill/borders/dash/align, band/header/total emphasis, diagonal borders (SVG overlay). Read-only; pattern fills, scheme-colour band resolution, rich per-run cell text still TODO                                                                          |
| Charts (SVG)                                                   | ◑      | `ChartRenderer.vue` + `chart/ChartChrome.vue` + `composables/chart-helpers.ts` — bar/column, stacked & 100%-stacked, line, area, pie/doughnut + axes/gridlines/legend/title/data-labels. Deferred (labelled placeholder): radar, scatter/bubble, stock, surface, treemap, sunburst, funnel, waterfall, combo, map, boxWhisker, histogram, ofPie; + secondary/log axes, trendlines, overlays |
| SmartArt                                                       | ◑      | `SmartArtRenderer.vue` — renders the core-decomposed `smartArtData.drawingShapes` (rect/ellipse + text/fill/stroke/rotation/shadow) as SVG, mirroring React `smartart-drawing.tsx`. Node-list fallback when no drawing shapes; per-family layout-from-nodes (cycle/gear/matrix/…) deferred                                                                                                  |
| Ink / OLE / Model3D / Zoom                                     | ◑      | `InkRenderer` (SVG strokes), `OleRenderer` (preview/icon+label), `Model3DRenderer` (poster, three.js deferred), `ZoomRenderer` (static link tile, navigation deferred)                                                                                                                                                                                                                      |
| Shape effects (shadow/glow/soft-edge/reflection), clip-paths   | ◑      | `composables/visual-effects.ts` — outer/inner/multi shadow, glow, soft-edge/blur, reflection (`-webkit-box-reflect`), DAG blend/opacity, wired into `getShapeFillStrokeStyle`. Preset-geometry clip-paths (`shape-geometry.ts`)                                                                                                                                                             |
| Shape 3D (scene3d/extrusion/bevel/material)                    | ◑      | `composables/visual-3d.ts` — camera perspective→`transform`, extrusion→layered box-shadow, bevel/contour/material/light-rig, merged into `getShapeFillStrokeStyle` (`merge3dStyle` comma-joins shadows; container rotation composed in `ElementRenderer`). Real CSS-3D extruded faces (`Extrusion3DOverlay`) deferred                                                                       |
| Image effects (recolour/artistic/duotone)                      | ◑      | `composables/image-effects.ts` — recolour (brightness/contrast/saturate/grayscale/sepia/hue), duotone + advanced-alpha + artistic via SVG `<filter>` defs (injected in the image branch), `alphaModFix` opacity. Destructive `clrChange` chroma-key & canvas re-encodes deferred                                                                                                            |
| Equations (OMML → MathML)                                      | ◑      | `EquationRenderer.vue` + `composables/omml-to-mathml.ts` — converts `TextSegment.equationXml` OMML to MathML (fraction/sub/sup/radical/n-ary/matrix/accent/delimiter/func…), DOMPurify-sanitised, rendered via native `<math>`; `ElementRenderer` delegates elements with equation segments. Exotic constructs (phant/scaling) deferred                                                     |
| Text warp / WordArt                                            | ◑      | `WordArtText.vue` + `composables/text-warp.ts` — SVG `<textPath>` for arch/wave/circle/triangle/chevron/inflate/can/cascade/slant/fade presets; `ElementRenderer` delegates warped text. Envelope/simple CSS-transform presets deferred                                                                                                                                                     |
| Fills: structured gradients + preset patterns                  | ◑      | `composables/fill-style.ts` — `getComputedFillStyle` resolves image→structured gradient (linear/radial)→preset pattern (inline-SVG)→solid (with alpha), replacing the old prebuilt-string fill in `getShapeFillStrokeStyle`. Gradient flip/tiling deferred                                                                                                                                  |

### Editor chrome (started)

| Item                                                              | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editing interaction core                                          | ◑      | `useSelection` + `SelectionOverlay.vue` (8 resize handles + rotate + drag) + `element-interaction.ts` (pure transform/resize/rotate math) + `EditorToolbar.vue` (undo/redo/zoom/add-text/add-shape/delete/duplicate/forward/backward). **Wired into `PowerPointViewer`** behind `canEdit`: click-to-select (event delegation on `data-element-id`), drag/resize via overlay (1 history entry/gesture), Ctrl+Z/Y + Delete shortcuts. Edits flow to `getContent()` export |
| Inspector panels (fill/stroke/text/image/table/chart/animation/…) | ◑      | `inspector/InspectorPane.vue` + `ArrangePanel`/`FillPanel`/`StrokePanel`/`TextPanel`/`EffectsPanel`; wired into `PowerPointViewer` (right sidebar, single selection → `ops.updateElement`). Image/table/chart/animation panels still ☐                                                                                                                                                                                                                                  |
| Context menu + dialogs                                            | ◑      | `ContextMenu.vue` right-click (cut/copy/paste/delete/duplicate/forward/backward/**hyperlink**); reusable `ModalDialog.vue` + `HyperlinkDialog.vue` (edit element `actionClick` hyperlink). Other dialogs (share/broadcast/settings/properties) still ☐                                                                                                                                                                                                                  |
| Slides pane                                                       | ◑      | `useSlideOperations` (add/delete/duplicate/move slide, history-aware) + `SlidesPaneControls.vue` in the thumbnail rail. Drag-reorder, slide sorter, notes, mobile chrome, accessibility panel still ☐                                                                                                                                                                                                                                                                   |

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
- **2026-06-15** — SmartArt + Ink/OLE/Model3D/Zoom + shape visual effects
  (three parallel subagents). **SmartArt:** `SmartArtRenderer.vue` renders the
  core-decomposed `smartArtData.drawingShapes` as SVG (the `smartart-drawing.tsx`
  path), with a node-text-list fallback; per-family layout-from-nodes deferred.
  **Misc elements:** `InkRenderer` (SVG strokes), `OleRenderer` (preview/icon +
  type label), `Model3DRenderer` (poster image; three.js deferred),
  `ZoomRenderer` (static link tile; navigation deferred). **Effects:**
  `composables/visual-effects.ts` computes box-shadow / CSS filter (glow,
  soft-edge/blur, DAG grayscale/biLevel/hsl/tint) / `-webkit-box-reflect` /
  mix-blend-mode / DAG opacity, wired into `getShapeFillStrokeStyle` ahead of
  the geometry cascade; the duotone `url(#…)` SVG-filter ref is stripped (the
  `<filter>` injection + image recolour/artistic/duotone are deferred).
  `ElementRenderer` now delegates **every** element type — the generic
  placeholder is defensive-only. 69 new tests (110 total green);
  typecheck/lint clean; build green (53 modules). Integrated + committed
  centrally from a `main` worktree (shared checkout left untouched on the
  Angular branch); rebased over 3 concurrent Angular pushes to `main`.
- **2026-06-15** — Image effects + shape 3D + equations (three parallel
  subagents). **Image effects** (`composables/image-effects.ts`): recolour CSS
  filter + duotone/advanced-alpha/artistic SVG `<filter>` defs, applied to the
  `<img>` and injected in the image branch of `ElementRenderer`. **Shape 3D**
  (`composables/visual-3d.ts`): scene3d camera→`transform`/perspective,
  extrusion→layered box-shadow, bevel/contour/material/light-rig, merged into
  `getShapeFillStrokeStyle` via `merge3dStyle` (comma-joins shadows so it doesn't
  clobber the effect shadow; the container rotation/flip transform is composed
  with the 3D transform in a new `shapeDivStyle` computed). **Equations**
  (`EquationRenderer.vue` + `composables/omml-to-mathml.ts`): `TextSegment.
equationXml` OMML → MathML (ported from React's three omml-\* files, core only
  had OMML↔LaTeX), DOMPurify-sanitised, native `<math>`; `ElementRenderer`
  delegates elements carrying equation segments. 106 new tests (216 total
  green); typecheck/lint clean; build green. Worktree integration used a
  **targeted file copy** (not `git stash -u`) per the sharpened shared-worktree
  rule, leaving the Angular session's checkout untouched.
- **2026-06-15** — Batch 4 (three parallel subagents): **text-warp/WordArt**
  (`WordArtText.vue` + `composables/text-warp.ts`, SVG `<textPath>`, delegated
  from `ElementRenderer` when `hasTextWarp`); **structured fills**
  (`composables/fill-style.ts` — `getComputedFillStyle` now drives
  `getShapeFillStrokeStyle`'s fill: image→gradient(linear/radial)→preset
  pattern→solid); **editing foundation** (`composables/useEditorHistory.ts`
  undo/redo + `composables/useEditorOperations.ts` element CRUD/transform — built
  & tested, not yet wired into `PowerPointViewer`; they unlock the editor-chrome
  batches). 91 new tests (307 total green); typecheck/lint clean; build green.
  This begins the **editing/interaction** frontier — next: wire the foundation
  into `PowerPointViewer` + selection/drag/resize overlays, then toolbar/inspector
  chrome. Decision: chrome continues hand-written scoped `pptx-vue-` CSS (no
  Tailwind pipeline) for consistency with the existing components.
- **2026-06-15** — Batch 5: editing interaction core. `useSelection` +
  `element-interaction.ts` (DOM-free drag/resize/rotate math, 8 handles, honours
  `MIN_ELEMENT_SIZE` + element rotation) + `SelectionOverlay.vue` (selection box,
  resize/rotate handles; emits `transformStart`/`transform`/`transformEnd`) +
  `EditorToolbar.vue`. Wired into `PowerPointViewer` behind `canEdit`: the
  editing composables (`useEditorHistory`/`useEditorOperations`) now drive real
  edits — click-to-select via event delegation, drag/resize through the overlay
  (snapshot on gesture-start → one undo entry per gesture), add-text/add-shape
  (core `createTextElement`/`createShapeElement`), delete/duplicate/reorder, and
  Ctrl+Z/Y + Delete shortcuts. The overlay mounts inside `SlideStage`'s scaled
  space via a new slot threaded through `SlideCanvas`. Edits mutate the
  `useLoadContent` `slides` ShallowRef, so `getContent()` serialises them. 59 new
  tests (366 total green incl. a `PowerPointViewer` edit-mode smoke test);
  typecheck/lint clean; build green. Three parallel subagents + central wiring.
  **The interactive editing core is now live** — the editor-chrome batches
  (inspector panels, dialogs, context menu, slides pane) build on this.
- **2026-06-15** — Batch 6: inspector panels. `inspector/InspectorPane.vue`
  composes per-concern panels for the selected element: `ArrangePanel`
  (x/y/w/h/rotation/flip), `FillPanel` (mode/color/opacity), `StrokePanel`
  (color/width/dash), `TextPanel` (font/size/bold/italic/underline/strike/color/
  align/vAlign), `EffectsPanel` (opacity/shadow/glow). All panels share one
  contract — `props { element }`, `emit update(patch: Partial<PptxElement>)` with
  nested style sub-objects pre-merged — so the shell just relays. Wired into
  `PowerPointViewer`'s right sidebar (shown for a single selection); patches go
  through `ops.updateElement` (one undo entry per change). EffectsPanel writes
  the real flat `ShapeStyle` shadow/glow fields (`shadowColor`/`shadowBlur`/…,
  `glowColor`/`glowRadius`) that `visual-effects.ts` reads. 26 new tests (392
  total green); typecheck/lint clean; build green. Three parallel subagents +
  central shell/wiring. Next chrome: image/table/chart panels, context menu,
  dialogs, slides pane.
- **2026-06-15** — Batch 7: slides pane + presentation mode + context menu.
  `useSlideOperations` (add/delete/duplicate/move slide, history-aware; blank
  slide = minimal `PptxSlide` literal, duplicate via core `cloneSlide`) +
  `SlidesPaneControls.vue` in the thumbnail rail. `PresentationMode.vue` —
  teleported full-viewport slideshow rendering `SlideStage` scaled-to-fit, with
  keyboard nav (arrows/space/PageUp-Dn/Home/End/Esc), click-to-advance, and
  Fullscreen API; opened by a Present button. `ContextMenu.vue` (generic
  teleported menu) wired to canvas right-click → cut/copy/paste/delete/duplicate/
  bring-forward/send-backward, backed by an in-memory element clipboard
  (`cloneElement` + `createEditorId`). 31 new tests (423 total green);
  typecheck/lint clean; build green. Three parallel subagents + central wiring.
  Next: dialogs (properties/hyperlink/share), drag-reorder slides, slide
  transitions/animations, export (PNG/PDF), find/replace, comments, collaboration.
- **2026-06-15** — Batch 8: find/replace + dialogs. `useFindReplace` +
  `FindReplaceBar.vue` — Ctrl+F bar with cross-slide text search, prev/next,
  replace + replace-all (rewrites both `element.text` and `textSegments[].text`,
  history-aware). Reusable `ModalDialog.vue` (teleported, Esc/backdrop close,
  footer slot) + `HyperlinkDialog.vue` editing the element-level `actionClick`
  hyperlink (url + tooltip), opened from a new "Hyperlink…" context-menu item and
  applied via `ops.updateElement`. 30 new tests (453 total green);
  typecheck/lint clean; build green. Two parallel subagents + central wiring.
  **Still ☐ (heavier, dedicated work):** export (PNG/PDF/GIF — needs
  `html2canvas-pro` added to vue deps + offscreen slide rasterization),
  collaboration (Yjs), animations/transitions, comments, digital signatures,
  font embedding, slide sorter, notes, mobile chrome, accessibility panel,
  remaining inspector panels (image/table/chart/animation), drag-reorder slides.
