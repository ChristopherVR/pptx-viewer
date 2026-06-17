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
| Clipboard, find/replace, autosave                                                                                                                  | ◑      | clipboard (context menu) + `useFindReplace`/`FindReplaceBar` (Ctrl+F) + **`useAutosave`/`AutosaveIndicator`** (debounced, `autosave`/`autosaveIntervalMs` props → `@autosave` bytes). Comments still ☐                                                                     |
| Align / distribute / group                                                                                                                         | ◑      | `element-align.ts` (align L/CenterH/R/T/M/B + distribute H/V) + `AlignToolbar.vue` (incl. group/ungroup using core `createGroupElement` + relative-coord offset), wired into `PowerPointViewer` (one history entry per op)                                                 |

### Rendering

| Item                                                           | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PowerPointViewer.vue` (load + nav + zoom)                     | ◑      | loading/error/encrypted states, prev/next, zoom, **live thumbnail previews**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `SlideStage.vue`                                               | ◑      | reusable scaled stage (bg + elements); shared by canvas + thumbnails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `SlideCanvas.vue`                                              | ◑      | centres `SlideStage` in a scrollable viewport; no rulers/grid/guides/overlays                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ElementRenderer.vue`                                          | ◑      | text, shape (fill/stroke + preset clip-paths), picture/image, media poster, group recursion; placeholders for the rest. Component tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `element-style.ts`                                             | ◑      | container/shape/text/image basics + gradient & image fills + **preset-geometry clip-paths** (roundRect radius / ellipse / clip-path / line / cylinder); no effects/3D                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `shape-geometry.ts` (clip-path cascade)                        | ◑      | mirrors React `getResolvedShapeClipPath`; imports core's evaluator/adjustment-aware/cloud/static entry points directly (no shared extraction needed — core is framework-agnostic)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| text: `picture`/`image`                                        | ◑      | `<img>` object-fit contain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| text: rich text runs (bold/italic/underline/strike/color/size) | ◑      | per-segment spans, paragraph + line breaks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Connectors (SVG)                                               | ◑      | `ConnectorRenderer.vue` + `composables/connector-routing.ts` — straight line + arrowheads + dash; **bent (bentConnector2–5, orthogonal elbows, adj-aware)**, **curved (curvedConnector2–5, Q/C Beziers, flip-aware)**, and **compound lines (dbl/thickThin/thinThick/tri — parallel offset strokes)** all rendered via core's `getConnectorPathGeometry`. **Connector text overlay done** (`ConnectorTextOverlay.vue` — centred label from text/textSegments/textStyle, per-run styling + justify-variant alignment)                                                                                                                                                                                                                                                                                                                                                                                             |
| Tables                                                         | ◑      | `TableRenderer.vue` + shared `table-style.ts` — HTML `<table>`, colgroup widths/row heights, rowspan/colspan merges, per-cell fill/borders/dash/align, band/header/total emphasis, diagonal borders (SVG overlay). **Now also: rich per-run cell text (styled `<span>`s, para/line breaks), preset pattern fills (tiled inline-SVG, not flat colour), and theme scheme-colour band resolution** (tint/shade-aware; `colorScheme` provided viewer-root via `composables/table-theme.ts` `provide`/`inject`, so no theme prop-threading through `SlideStage`/`ElementRenderer`). **Now also: `tableStyleMap` GUID lookups** — `useLoadContent` exposes `parsed.tableStyleMap` (core parses `ppt/tableStyles.xml`); `PowerPointViewer` provides it alongside `colorScheme` through `TableThemeKey`, so banding/header/total/first-last emphasis resolve by table-style GUID (not just the colour scheme). Read-only |
| Charts (SVG)                                                   | ◑      | `ChartRenderer.vue` + `chart/ChartChrome.vue` + `chart/*.vue` + shared `chart-helpers.ts` — bar/column, stacked & 100%-stacked, line, area, pie/doughnut + axes/gridlines/legend/title/data-labels. **Now also rendered (own SVG sub-components): radar, scatter, bubble, waterfall, funnel, sunburst, treemap, combo (column+line), stock (OHLC), histogram, boxWhisker.** Still placeholder: surface (needs 3D/isometric port), regionMap (needs world-map path data); + secondary/log axes, trendlines, overlays                                                                                                                                                                                                                                                                                                                                                                                              |
| SmartArt                                                       | ◑      | `SmartArtRenderer.vue` + `composables/smartart-layout.ts` — renders the core-decomposed `smartArtData.drawingShapes` as SVG (primary path, mirrors React `smartart-drawing.tsx`). **Fallback (no drawing shapes) now runs a pure-geometry layout engine** for 10 families — list, process (chevrons), cycle, hierarchy/org-tree, matrix, radial/relationship, pyramid, venn, funnel, target — chosen from `resolvedLayoutType`/`layout`, replacing the old plain text-list. Handles both flat `parentId` and pre-nested `children` node shapes                                                                                                                                                                                                                                                                                                                                                                   |
| Ink / OLE / Model3D / Zoom                                     | ◑      | `InkRenderer` (SVG strokes), `OleRenderer` (preview/icon+label), `Model3DRenderer` (poster, three.js deferred), `ZoomRenderer` (static link tile, navigation deferred)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Shape effects (shadow/glow/soft-edge/reflection), clip-paths   | ◑      | `composables/visual-effects.ts` — outer/inner/multi shadow, glow, soft-edge/blur, reflection (`-webkit-box-reflect`), DAG blend/opacity, wired into `getShapeFillStrokeStyle`. Preset-geometry clip-paths (`shape-geometry.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Shape 3D (scene3d/extrusion/bevel/material)                    | ◑      | `composables/visual-3d.ts` — camera perspective→`transform`, extrusion→layered box-shadow, bevel/contour/material/light-rig, merged into `getShapeFillStrokeStyle` (`merge3dStyle` comma-joins shadows; container rotation composed in `ElementRenderer`). Real CSS-3D extruded faces (`Extrusion3DOverlay`) deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Image effects (recolour/artistic/duotone)                      | ◑      | `composables/image-effects.ts` — recolour (brightness/contrast/saturate/grayscale/sepia/hue), duotone + advanced-alpha + artistic via SVG `<filter>` defs (injected in the image branch), `alphaModFix` opacity. Destructive `clrChange` chroma-key & canvas re-encodes deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Equations (OMML → MathML)                                      | ◑      | `EquationRenderer.vue` + `composables/omml-to-mathml.ts` — converts `TextSegment.equationXml` OMML to MathML (fraction/sub/sup/radical/n-ary/matrix/accent/delimiter/func…), DOMPurify-sanitised, rendered via native `<math>`; `ElementRenderer` delegates elements with equation segments. Exotic constructs (phant/scaling) deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Text warp / WordArt                                            | ◑      | `WordArtText.vue` + `composables/text-warp.ts` — SVG `<textPath>` for arch/wave/circle/triangle/chevron/inflate/can/cascade/slant/fade presets; `ElementRenderer` delegates warped text. Envelope/simple CSS-transform presets deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Fills: structured gradients + preset patterns                  | ◑      | `composables/fill-style.ts` — `getComputedFillStyle` resolves image→structured gradient (linear/radial)→preset pattern (inline-SVG)→solid (with alpha), replacing the old prebuilt-string fill in `getShapeFillStrokeStyle`. Gradient flip/tiling deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Editor chrome (started)

| Item                                                            | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editing interaction core                                        | ◑      | `useSelection` + `SelectionOverlay.vue` (8 resize handles + rotate + drag) + `element-interaction.ts` (pure transform/resize/rotate math) + `EditorToolbar.vue` (undo/redo/zoom/add-text/add-shape/delete/duplicate/forward/backward). **Wired into `PowerPointViewer`** behind `canEdit`: click-to-select (event delegation on `data-element-id`), drag/resize via overlay (1 history entry/gesture), Ctrl+Z/Y + Delete shortcuts. Edits flow to `getContent()` export |
| Inspector panels (fill/stroke/text/image/table/chart/animation) | ✅     | `InspectorPane` + Arrange/Fill/Stroke/Text/Effects/Image/Table/**Chart** (type/title/grouping via core `chartDataChangeType`/`setChartTitle`)/**Animation** (entrance/emphasis/exit presets + trigger; animations live on `slide.animations` keyed by `elementId`, so the host augments the inspector element + routes the patch to the slide). Single selection → `ops.updateElement` (or slide for animations)                                                        |
| Context menu + dialogs                                          | ◑      | `ContextMenu.vue` right-click (cut/copy/paste/delete/duplicate/forward/backward/**hyperlink**); reusable `ModalDialog.vue` + `HyperlinkDialog.vue` (edit element `actionClick` hyperlink). Other dialogs (share/broadcast/settings/properties) still ☐                                                                                                                                                                                                                  |
| Slides pane + sorter                                            | ◑      | `useSlideOperations` (add/delete/duplicate/move) + `SlidesPaneControls`; **`SlideSorter.vue`** grid overview with HTML5 drag-reorder (→ `moveSlide`); **`SlideTransitionPanel.vue`** (per-slide transition type+duration, history-aware). Notes, mobile chrome still ☐                                                                                                                                                                                                  |
| Accessibility panel                                             | ◑      | `useAccessibility` (core `checkMissingAltText`/`checkLowContrast`/… aggregated) + `AccessibilityPanel.vue` — grouped issues, click → jump to slide; header button shows live issue count                                                                                                                                                                                                                                                                                |

### Presentation, print & shortcuts (Batch 18)

| Item                                  | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation chrome (presenter + ink) | ◑      | `PresentationToolbar.vue` (nav/pen/highlighter/laser/eraser/clear + presenter toggle + end), `PresentationAnnotationOverlay.vue` (SVG ink, self-scaled), `usePresentationAnnotations` (per-slide pen/highlighter/eraser/laser stroke state), `PresenterView.vue` (next-slide preview + speaker notes + timer), `PresentationSubtitleBar.vue` (Web-Speech captions, `C` toggle), `RehearseTimingsHud`/`useRehearseTimings`. **Wired into `PresentationMode.vue`** (tap-to-advance gated while a tool is armed / presenter view open) |
| Print                                 | ◑      | `usePrint` (settings + range parse + rasterise-to-print-window, reuses export `rasterizeSlide`) + `PrintDialog.vue` + `PrintSettingsPanel.vue` + pure `print-dialog-types.ts` (slides/notes/handouts/outline, slides-per-page, color/grayscale, frame, range). **Wired** into the header (🖨). SVG-vector print path deferred                                                                                                                                                                                                       |
| Keyboard shortcuts + help             | ◑      | `useKeyboardShortcuts` (config-driven registry + `matchShortcut`/`handleKeyDown`, guard flags, `SHORTCUT_CATALOG`) replaces the ad-hoc Ctrl+Z/Y/Delete handling — undo/redo/copy/cut/paste/duplicate/delete/select-all/nudge/slide-nav/escape; `ShortcutPanel.vue` searchable help overlay (Ctrl+/ or ⌨ button)                                                                                                                                                                                                                     |
| Document properties (full)            | ✅     | `DocumentPropertiesDialog.vue` (General/Statistics/Custom tabs) + `useDocumentStatistics` (live slide/word/paragraph/element counts) replaces the basic `PropertiesDialog`. Core **+ custom + app** property edits now round-trip via `getContent` (Batch 21 surfaced `customProperties`/`appProperties` in the loader)                                                                                                                                                                                                             |

### Advanced subsystems (status)

Done in earlier/this batch: presentation mode + animation playback + **presenter
view / ink annotations / rehearse timings (Batch 18)**, export (PNG/PDF via
`html2canvas-pro`), **print (Batch 18)**, find/replace, comments, collaboration
(Yjs whole-doc + cursors), digital signatures, font embedding, **comprehensive
keyboard shortcuts (Batch 18)**, **master views + header/footer (Batch 19)**,
**sections + custom shows (Batch 19)**, **version history + compare (Batch 20)**,
**insert-SmartArt + equation-editor dialogs (Batch 20)**, **settings dialog
(Batch 20)**, **GIF + WebM export (Batch 21)**, **slide-transition overlay
animations (Batch 21)**, **fine-grained collaboration — selection presence +
follow-mode (Batch 21)**, **custom/app document-property round-trip (Batch 21)**.

Still ☐ / partial: the component- and feature-level surface is now at **full
parity** with React. Remaining items are genuinely optional depth: richer
conflict-resolving CRDT merge (current collab is whole-doc last-write-wins with
presence/follow on top), and the GIF encoder is vendored per-binding (React /
Angular / Vue each carry a copy — a `pptx-viewer-shared/render` extraction
candidate, like the Batch-21 `latex-to-omml` hoist).

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
- **2026-06-15** — Batch 9: export + image/table inspector panels. **Export**
  (`composables/useExport.ts` + `ExportMenu.vue`): PNG (current slide) and
  multi-page PDF via lazy `jspdf`, rasterising each slide with `html2canvas-pro`
  over an off-screen `SlideStage` (`rasterizeSlide` injected so the composable is
  DOM-free + unit-tested with mocks). Added `html2canvas-pro` (+ moved `jspdf`)
  to the vue package `dependencies` and the vite `external` list (both stay
  externalised/lazy — not bundled). **Inspector**: `ImagePanel` (alt-text +
  brightness/contrast/saturation writing `imageEffects`, the same fields
  `image-effects.ts` reads) and `TablePanel` (insert/delete row+column on a
  cloned `tableData`, header-row toggle) added to `InspectorPane`. 20 new tests
  (473 total green); typecheck/lint clean; build green. Two parallel subagents
  (panels) + export written directly (dependency-coupled).
- **2026-06-15** — Batch 10: accessibility + slide sorter + transitions.
  `useAccessibility` (aggregates core `checkMissingAltText`/`checkMissingSlideTitle`/
  `checkLowContrast`/`checkComplexTables`/`checkBlankSlide`/`checkDuplicateTitles`
  — `checkPresentation` needs full `PptxData`, so the per-check fns are called
  over slides) + `AccessibilityPanel.vue` (grouped issues, click→jump, live count
  in a header button). `SlideSorter.vue` (grid overview, HTML5 drag-reorder →
  `slideOps.moveSlide`, opened from a header button as a full overlay).
  `SlideTransitionPanel.vue` (per-slide transition type from the real
  `PptxTransitionType` union + `durationMs`, written to `slide.transition` via a
  history-aware reassignment) in the thumbnail rail. 19 new tests (492 total
  green); typecheck/lint clean; build green. Three parallel subagents + central
  wiring. **Remaining ☐:** collaboration (Yjs), animations (element-level
  entrance/exit/emphasis + playback), comments, notes editing, digital
  signatures, font embedding, mobile chrome, chart/animation inspector panels,
  autosave, broadcast/share/properties dialogs.
- **2026-06-15** — Batch 11: animation + chart + notes. **AnimationPanel**
  (entrance/emphasis/exit presets from core `ENTRANCE_PRESETS`/… + trigger);
  animations are stored on `slide.animations` (keyed by `elementId`), so
  `PowerPointViewer` augments the inspector element with its slide animations and
  routes an `animations` patch to a history-aware `slide.animations` write.
  **ChartPanel** (chart type via `chartDataChangeType`, title via `setChartTitle`,
  grouping via `setChartGrouping`). **NotesPanel** (`slide.notes` — already
  populated by the loader — edited via history-aware slide reassignment, below
  the canvas). The inspector panel set is now **complete** (Arrange/Fill/Stroke/
  Text/Effects/Image/Table/Chart/Animation). 16 new tests (508 total green);
  typecheck/lint clean; build green. Three parallel subagents + central wiring.
  **Remaining ☐:** collaboration (Yjs), animation _playback_ in presentation
  mode, comments (needs loader to surface comment data), digital signatures,
  font embedding, broadcast/share/properties dialogs, autosave, mobile chrome.
- **2026-06-15** — Batch 12: align/distribute/group + autosave. `element-align.ts`
  (pure align-to-bbox + even-distribute geometry) + `AlignToolbar.vue` (align
  6-way, distribute H/V, group/ungroup); group wraps the selection into a core
  `createGroupElement` with children offset to group-relative coords, ungroup
  re-absolutises them (mirrors the parser convention). `useAutosave` (debounced,
  status machine, `vi.useFakeTimers`-testable) + `AutosaveIndicator.vue`; new
  public `autosave`/`autosaveIntervalMs` props + `@autosave` emit. Both wired
  into `PowerPointViewer` (one history entry per align/group op). 31 new tests
  (539 total green); typecheck/lint clean; build green. Two parallel subagents +
  central wiring. **Remaining ☐ (heaviest):** collaboration (Yjs real-time +
  cursors), animation _playback_ in presentation, comments (needs loader to
  surface comment data), digital signatures, font embedding, broadcast/share/
  properties dialogs, mobile chrome.
- **2026-06-15** — Batch 13: comments + animation playback + share/properties.
  **Comments** (`useComments` + `CommentsPanel.vue`): per-slide `slide.comments`
  (already loaded), add/remove/resolve via history-aware writes, toggle panel.
  **Animation playback** (`animation-css.ts` preset→CSS-keyframes map +
  `useAnimationPlayback.ts` click-group stepper) wired into `PresentationMode` —
  injects `@keyframes` once, applies per-element styles by `data-element-id`, and
  each "next" reveals the slide's next build before advancing the slide.
  **Share dialog** (collaboration form → `@start-collaboration`/`@stop-collaboration`)
  and **Properties dialog** (`PptxCoreProperties` view/edit) on the existing
  `ModalDialog`; `useLoadContent` now exposes `coreProperties`. 79 new tests (587
  total green); typecheck/lint clean; build green. Three parallel subagents +
  central wiring. **Caveat:** AnimationPanel writes catalog preset ids
  (`entr.N`); playback keys on the parsed `PptxAnimationPreset` string union, so
  panel-added animations fall back to a fade until the id mapping is unified.
  Properties save is in-memory (not yet persisted to the saved `.pptx`).
  **Remaining ☐:** Yjs collaboration (real-time/cursors), digital signatures,
  font embedding, mobile chrome, broadcast dialog.
- **2026-06-15** — Batch 14: collaboration + signatures + embedded fonts. **Yjs
  collaboration** (`useCollaboration.ts`): lazy yjs/y-websocket, whole-document
  JSON slide broadcast via a shared `Y.Map` (last-write-wins) + awareness-based
  remote cursors; `CollaborationCursors.vue` overlay (scaled stage), pointer-move
  publishes the local cursor; ShareDialog start/stop drives `collab.start/stop`.
  **Digital signatures** (`useSignatures` + `SignaturesPanel.vue`): `useLoadContent`
  now parses `_xmlsignatures/*.xml` (lazy jszip/fast-xml-parser → `parseSignatureXml`)
  and exposes `signatures`; a header badge shows the overall status. **Embedded
  fonts** (`useEmbeddedFonts`): `useLoadContent` exposes `embeddedFonts`, injected
  as `@font-face` (de-obfuscation handled by the loader). Added yjs/y-websocket to
  vue deps (already in the vite `external` list). 29 new tests (616 total green);
  typecheck/lint clean; build green. Three parallel subagents (cursors/signatures/
  fonts) + `useCollaboration` written directly. **Collaboration is foundational**
  — whole-doc sync + cursors, not yet fine-grained CRDT / presence / follow-mode.
  **Remaining ☐:** broadcast dialog, mobile chrome, granular CRDT collaboration,
  unified animation-preset id mapping, properties persistence to saved `.pptx`.
- **2026-06-15** — Batch 15 (final polish): broadcast + mobile + animation-id fix.
  **BroadcastDialog.vue** (one-way present-to-audience: room/server form →
  starts a collab session; viewer link + copy) wired with a viewer-URL builder.
  **Mobile chrome**: `useIsMobile` (matchMedia) + `MobileBottomBar.vue` (fixed
  touch bar: nav/zoom/present/menu); the desktop header is hidden under 768px.
  **Animation-preset fix**: `AnimationPanel` now converts the editor catalog id
  (`entr.10`) to the real `PptxAnimationPreset` string (`fadeIn`) via core
  `ooxmlToPresetName`, so panel-added animations resolve to the correct keyframe
  in `PresentationMode` (no more fade-fallback). 18 new tests (634 total green);
  typecheck/lint clean; build green.

> **Port status (2026-06-15):** the Vue editor now covers essentially the full
> React feature surface — rendering (all element types + effects/3D/equations/
> warp), editing (select/drag/resize/align/group/undo), the complete inspector
> (9 panels), slides pane + sorter + transitions + notes, presentation mode with
> animation playback, find/replace, comments, export (PNG/PDF), accessibility,
> hyperlink/properties/share/broadcast dialogs, autosave, embedded fonts, digital
> signatures, Yjs collaboration (cursors), and mobile chrome. **Known
> limitations / not-yet-done:** collaboration is whole-document broadcast (not
> fine-grained CRDT) with cursors but no selection-presence/follow-mode;
> Properties edits are in-memory (not persisted to the saved `.pptx`); GIF/video
> export, presenter view, and the 8-way directional animation variants are
> deferred. 634 tests; everything green on `main`.

- **2026-06-15** — Properties persistence fix + **shared-code extraction wave 1**.
  Fixed: `getContent` now passes `{ coreProperties }` to `handler.save`, so
  Properties-dialog edits persist into the exported `.pptx` (was in-memory only).
  Extraction: 10 framework-agnostic modules moved from `packages/vue/.../composables`
  into **`packages/shared/src/render/`** (new `pptx-viewer-shared` barrel
  `./render`, re-exported from the package root): `shape-geometry`, `fill-style`,
  `visual-effects`, `image-effects`, `text-warp`, `omml-to-mathml`, `chart-helpers`,
  `animation-css`, `element-align`, `element-interaction` (+ their ~227 tests now
  run under shared). Vue imports them from `pptx-viewer-shared`; React/Angular can
  now reuse the same code. Deduped collisions (color helpers → canonical in
  `fill-style`; image-effects' SVG-filter helpers renamed `Image*`). Vue dist
  still inlines core+shared (verified: only `vue`/`jszip`/`fast-xml-parser`/
  `dompurify` external). 649 tests total (417 vue + 232 shared), all green.
  **Still in vue (need `CSSProperties`→agnostic-type genericisation before moving):**
  `visual-3d`, `table-style`, `element-style`. Vue-inherent composables stay
  (useLoadContent/Editor\*/Selection/etc.).

- **2026-06-15** — **Shared-code extraction wave 2** (`visual-3d` + `table-style`).
  Moved the pure scene3d/shape3d 3D engine into **`packages/shared/src/render/visual-3d.ts`**
  (camera/extrusion/contour/bevel/material/light-rig → CSS pieces; the aggregate
  `getComputed3dStyle` returns plain string/number fields, no framework type).
  Vue's `composables/visual-3d.ts` is now a thin adapter: it re-exports the shared
  pure fns and keeps only the framework-coupled `merge3dStyle` (folds the pieces
  into a Vue `CSSProperties`). Moved the table render helpers into
  **`packages/shared/src/render/table-style.ts`** (`cellStyleToCss`,
  `getTableCellBandStyle`, `getDiagonalBorders`, `ooxmlDashToCssBorderStyle`),
  swapping `CSSProperties` for a framework-agnostic `TableCellCss =
Record<string, string | number>`; `TableRenderer.vue` now imports them from
  `pptx-viewer-shared`. Deleted the old `composables/table-style.ts`. React/Angular
  can now reuse both. Vue dist still inlines core+shared (runtime JS carries no
  `pptx-viewer-shared`/`pptx-viewer-core` specifiers; rolled-up `index.d.ts` clean).
  678 tests total (417 vue + 261 shared, +29 from the moved 3D suite), all green;
  vue typecheck clean.
  **Still in vue:** `element-style` (the Vue-facing CSSProperties assembler — stays;
  it composes the shared pieces into Vue's style object).

- **2026-06-15** — Batch 16: render-fidelity push (four parallel subagents on
  disjoint renderers). Closed the highest-value deferred rendering gaps:
  **Charts** — 11 exotic types that were labelled placeholders now render real
  SVG via new `chart/*.vue` sub-components (radar, scatter, bubble, waterfall,
  funnel, sunburst, treemap, combo, stock/OHLC, histogram, boxWhisker), reusing
  `ChartChrome` for axes/legend where applicable; only surface + regionMap remain
  placeholders. **Connectors** — bent (bentConnector2–5 orthogonal elbows,
  adjustment-aware), curved (curvedConnector2–5 Q/C Beziers, flip-aware), and
  compound lines (dbl/thickThin/thinThick/tri parallel offset strokes) now render
  via core's `getConnectorPathGeometry` (new thin `composables/connector-routing.ts`
  adds the compound-offset math). **SmartArt** — new pure `composables/smartart-layout.ts`
  geometry engine powers the no-drawing-shapes fallback with 10 family layouts
  (list/process/cycle/hierarchy/matrix/radial/pyramid/venn/funnel/target), chosen
  from `resolvedLayoutType`/`layout`; handles flat-`parentId` and nested-`children`
  node shapes. **Tables** — rich per-run cell text (styled `<span>`s + para/line
  breaks), preset pattern fills (tiled inline-SVG via shared `getPatternSvg`), and
  theme scheme-colour band resolution (tint/shade-aware) added to shared
  `table-style.ts`; the colour scheme reaches `TableRenderer` through a new
  viewer-root `provide`/`inject` (`composables/table-theme.ts`) so the hot
  `SlideStage`→`ElementRenderer` prop chain is untouched (`PowerPointViewer`
  provides `theme.colorScheme`). Central integration fixed a `SmartArtLayout`
  name collision (local result type → `SmartArtLayoutResult`) and ran
  `oxlint --fix`/`oxfmt`. **141 new tests (558 vue + 261 shared = 819 total, all
  green)**; vue typecheck clean; build green (189 modules), dist self-contained
  (runtime JS + rolled-up `index.d.ts`/`viewer/index.d.ts` carry no internal
  specifiers). Remaining renderer TODOs: connector text overlay, chart
  surface/regionMap + secondary/log axes/trendlines, table `tableStyleMap` GUID
  lookups (ppt/tableStyles.xml not loaded yet).

- **2026-06-16** — Batch 17: render-fidelity close-out (table GUIDs, connector
  labels, charts). Closed four of the five remaining renderer TODOs:
  **(a) Table `tableStyleMap` GUID lookups** — `useLoadContent` now exposes
  `parsed.tableStyleMap` (core already parses `ppt/tableStyles.xml` via the load
  pipeline; the `ParsedTableStyleMap` type + `TableStyleContext` plumbing in
  shared `table-style.ts` and `composables/table-theme.ts` were already in place
  from Batch 16 — only the load + provide wiring was missing). `PowerPointViewer`
  provides it through `TableThemeKey` alongside `colorScheme`, so band/header/
  total/first-last emphasis resolve by table-style GUID. **(b) Connector text
  overlay** — new `ConnectorTextOverlay.vue` renders a centred connector label
  from the element's `text`/`textSegments`/`textStyle` (per-run styling +
  justify-variant alignment), mirroring React `ConnectorTextOverlay`;
  `ConnectorRenderer` delegates when the element carries text segments.
  **(c) Charts** — _trendlines_ now render (new shared `chart-trendlines.ts`
  regression engine: linear/exponential/logarithmic/power/polynomial/movingAvg
  with equation + R² labels, ported from React `chart-trendlines.tsx`; new
  `chart/ChartTrendlines.vue` overlay drawn on top of bar/stacked/line/area).
  The two remaining placeholder chart types are now real: _surface_ (new
  `chart/SurfaceChart.vue` — isometric 2.5D SVG mesh, not Three.js) and
  _regionMap_ (new `chart/RegionMapChart.vue` — choropleth world map with
  in-component path data + value ramp). Both wired into `ChartRenderer` (added to
  the `RenderKind` union + dispatch; surface gets its own no-chrome SVG block,
  regionMap a no-axis block). **Still ☐ (the one deliberately-deferred chart
  gap):** secondary value axes (right-hand axis for series on a second `axisId`)
  - data tables, and log / display-unit value axes — the value axis is always
    linear. Left as a clear `// TODO(vue)` in `ChartRenderer.vue` (it rethreads the
    value→Y mapping through every chart sub-component, too invasive to land safely
    this batch). **+8 shared (269 total) + 24 vue (582 total) = 851 tests, all
    green**; vue typecheck/lint/fmt clean; build green, dist self-contained.
    Surface + regionMap built by two parallel `general-purpose` subagents (disjoint
    new files); trendlines + central integration done in-session.

- **2026-06-16** — Batch 18: editor-chrome parity (four parallel subagents +
  central wiring). Closed four React subsystems that had no Vue counterpart:
  **(a) Presentation chrome** — `PresentationToolbar.vue`, `PresentationAnnotationOverlay.vue`
  - `usePresentationAnnotations` (pen/highlighter/laser/eraser, per-slide stroke
    state), `PresenterView.vue` (next-slide preview + speaker notes + elapsed
    timer), `PresentationSubtitleBar.vue` (Web-Speech captions), `RehearseTimingsHud`
  - `useRehearseTimings`. **Wired into `PresentationMode.vue`**: armed-tool/presenter
    view gate tap-to-advance, toolbar `move`/`end`/`toggle-presenter`, `C` toggles
    captions, start-time stamped on mount. **(b) Print** — `usePrint` (settings +
    range parse + rasterise-to-print-window, reusing the export `rasterizeSlide`),
    `PrintDialog.vue`/`PrintSettingsPanel.vue`, pure `print-dialog-types.ts`
    (slides/notes/handouts/outline, slides-per-page, color/grayscale, frame, range);
    header 🖨 button. **(c) Keyboard shortcuts** — `useKeyboardShortcuts` config-driven
    registry (`matchShortcut`/`handleKeyDown` + guard flags + `SHORTCUT_CATALOG`)
    replaces the ad-hoc Ctrl+Z/Y/Delete handling (undo/redo/copy/cut/paste/duplicate/
    delete/select-all/nudge/slide-nav/escape); `ShortcutPanel.vue` searchable help
    (Ctrl+/ or ⌨). **(d) Full document properties** — `DocumentPropertiesDialog.vue`
    (General/Statistics/Custom tabs) + `useDocumentStatistics` (live counts) replaces
    the basic `PropertiesDialog` (core edits persist via `getContent`; custom/app
    round-trip deferred — loader doesn't surface them). Central wiring added the
    header buttons, swapped the properties dialog, and threaded `nudge`/`select-all`/
    clipboard actions into the new shortcut registry. **+201 tests (783 vue total,
    all green)**; typecheck clean; `oxlint --deny-warnings` clean on all new `.ts`;
    oxfmt clean; build green (dist self-contained, no internal specifiers). The Vue
    editor-chrome surface now matches React except master views, sections, version
    history/compare, insert-SmartArt/equation-editor dialogs, and the settings dialog.

- **2026-06-16** — Batch 19: master views + sections (two parallel subagents +
  central wiring). First extended `useLoadContent` (central, in-session) to surface
  five previously-unexposed `PptxData` fields — `sections`, `customShows`,
  `headerFooter`, `notesMaster`, `handoutMaster` (all already parsed by core) — and
  taught `getContent` to round-trip `sections`/`customShows`/`headerFooter` via
  `handler.save` options. **(a) Master views** — `MasterViewSidebar.vue` (slides/
  notes/handout tabs) + `SlideMastersList.vue` (live `SlideStage` previews of each
  master + its layouts via pseudo-`PptxSlide` conversion), `NotesMasterCanvas`/
  `NotesMasterPanel`, `HandoutMasterCanvas`/`HandoutMasterPanel` (slot-grid layout),
  and `HeaderFooterPanel.vue` (visibility flags + date/footer/slide-number fields,
  `update(next)` data-contract). Wired into the shell as a 📐 master-view overlay +
  a ▭ header/footer `ModalDialog`. **(b) Sections + custom shows** —
  `useSectionOperations` (add/rename/delete/move section, move-slides-to-section,
  collapse, `slidesBySection` grouping; `pushHistory`-aware) + `SectionList.vue`
  (collapsible sectioned slide rail, inline rename/reorder) replaces the flat
  thumbnail rail when the deck declares sections; `useCustomShows` +
  `CustomShowsPanel.vue` (🎬 toggle — create/rename/delete shows + ordered slide
  membership). **+94 tests (877 vue total, all green)**; typecheck clean;
  `oxlint --deny-warnings` clean on all new `.ts`; oxfmt clean; build green, dist
  self-contained. **Remaining ☐:** slide-version history/compare, insert-SmartArt &
  equation-editor dialogs, settings dialog, GIF/video export, custom/app
  document-property round-trip, transition-overlay animations, fine-grained CRDT.

- **2026-06-16** — Batch 20: version history/compare + insert dialogs + settings
  (three parallel subagents, one per group + central wiring). Closes the last
  component-level React→Vue gaps. **(a) Version history + compare** —
  `useVersionHistory` (deep-clone snapshots via core `cloneSlide`, history-aware
  restore, pure `capture(label, now)` so no `Date.now()` in the testable path) +
  pure `slide-compare.ts` (`compareSlides` → added/removed/changed rows by stable
  element id + numeric tolerance) + `VersionHistoryPanel.vue` (list/restore/delete/
  compare) + `ComparePanel.vue`/`SlideDiffRow.vue` (self-managed accept/reject).
  Wired: snapshots accrue on each **autosave**; 🕑 opens the panel; compare builds
  `compareSlides(version, current)`, accept-all restores the version. (Vue models
  versions as in-memory `PptxSlide[]` snapshots, not serialized `.pptx` blobs like
  React's IndexedDB store — restore is an undoable slide swap.) **(b) Insert
  dialogs** — `InsertSmartArtDialog.vue` + `SmartArtPreviews.vue` +
  `smart-art-presets.ts` (catalog) emit a renderable core SmartArt element;
  `EquationEditorDialog.vue` (LaTeX input + live MathML preview via the existing
  `omml-to-mathml`) emits a `shape` element carrying an `equationXml` segment. Both
  → `ops.addElement`. Needed a Vue-local `components/latex-to-omml.ts` (consolidated
  port of React's 4 `latex-to-omml-*` files — the conversion lives only in React,
  not core/shared; **extraction candidate** for `pptx-viewer-shared`). **(c)
  Settings** — `SettingsDialog.vue` + `viewer-settings.ts` (`ViewerSettings` +
  `DEFAULT_VIEWER_SETTINGS` + read-only shortcut reference); ⚙ opens it, host holds
  the settings object. **+216 tests (1093 vue total, all green)**; typecheck clean;
  `oxlint --deny-warnings` clean on all new `.ts`; oxfmt clean; build green, dist
  self-contained. **Component-level parity with React is now reached** — remaining
  gaps are depth-only (GIF/video export, transition-overlay animations, fine-grained
  CRDT presence/follow-mode, custom/app document-property round-trip) plus the
  `latex-to-omml` shared-extraction follow-up.

- **2026-06-16** — Batch 21: depth close-out (three parallel subagents + central
  wiring + two in-session central changes). Closes the deferred depth items, taking
  the Vue port to **full feature parity** with React. **(a) GIF + WebM export**
  (`useMediaExport` + a vendored pure-JS `gif-encoder.ts`, WebM via `MediaRecorder`
  over the existing off-screen `rasterizeSlide`; no new npm dep — mirrors React's
  self-contained encoder) wired into `ExportMenu` (GIF/WebM items) with a combined
  `isExporting` flag. **(b) Slide-transition overlay animations** (pure
  `slide-transition-css.ts` mapping `PptxSlideTransition` → CSS keyframes for
  fade/push/wipe/cover/split/dissolve/zoom/… with cross-fade fallback +
  `PresentationTransitionOverlay.vue`) wired into `PresentationMode`: the
  `currentIndex` watch arms an outgoing→incoming transition when the incoming slide
  declares one, cleared on `@done`. **(c) Collaboration depth** — extended
  `useCollaboration` awareness with selection + active-slide; new `remotePresences`,
  `setSelection`/`setActiveSlide`, `followUser`/`followedSlideIndex`; new
  `RemoteSelectionOverlay.vue` (peer selection boxes on the scaled stage) +
  `FollowModeBar.vue`. Host publishes selection/slide on change and watches
  `followedSlideIndex` → `goTo`. **(d) Custom/app document-property round-trip**
  (central): `useLoadContent` now surfaces `customProperties`/`appProperties` and
  `getContent` forwards them to `handler.save`; `DocumentPropertiesDialog` receives
  - persists them (General/Statistics/**Custom** tab fully live). **(e)
    `latex-to-omml` extraction** (central): moved the Vue-local converter into
    **`pptx-viewer-shared/render/latex-to-omml.ts`** (import `OmmlNode` relatively;
    added to the render barrel); `EquationEditorDialog` now imports it from
    `pptx-viewer-shared`, so React/Angular can reuse it. **Tests: shared 279 (+10
    moved latex), vue 1151 (net after the latex test moved to shared) — all green**;
    vue + shared typecheck clean; `oxlint --deny-warnings` clean on all changed/new
    `.ts`; oxfmt clean; vue build green, dist self-contained. **The Vue port now
    matches React at the feature level.** Only-remaining: conflict-resolving CRDT
    merge depth, and the per-binding GIF-encoder duplication (shared-extraction
    candidate).

- **2026-06-16** — Shared e2e suite (React + Vue), phases 1–3. The Playwright suite
  (`e2e/*.spec.ts`) now runs the **same spec bodies against both demos** —
  `playwright.config.ts` has projects `react`@4173 + `vue`@4175, each with its own
  `webServer` — and passes on both (**16/16 green**). **(1)** Ported the three pure
  helpers the specs' features need as Vue-local modules (`composables/{format-painter,
shape-adjustment,remap-text}.ts` + 56 ported tests; shared extraction deferred to
  avoid churn in the active React session). **(2)** Built the three missing editor
  features in Vue: **format painter** (arm/copy/apply/cancel + `EditorToolbar` button
  `data-testid="format-painter-toggle"` + neutral `data-active`), **inline text
  editing** (`InlineTextEditor.vue` `[data-inline-editor]`, entered by tapping an
  already-selected element, commit on blur/tap-away via `remapTextToSegments`), and
  **shape-adjustment handles** (amber diamond in `SelectionOverlay`,
  `aria-label="Adjust shape"`, hidden while presenting). Move/drag + tap-to-edit moved
  off the full-cover selection-body onto the element (host pointer delegation) so taps
  reach the element. Emitted the neutral DOM contract: gated `data-pptx-element="true"`
  to the **interactive** canvas only (threaded `interactive` prop — not thumbnails/
  sorter/export/presentation), `aria-roledescription="slide"` + `data-pptx-viewport`
  on the main stage/viewport, `#slide-notes-content` + `textarea[name="slide-notes"]`,
  a mobile **Notes** button. **(3)** Neutralized the specs (`bg-amber-600`→`[data-active]`,
  `.overflow-auto`→`[data-pptx-viewport]`, dead stage selector→`[aria-roledescription="slide"]`),
  added the two neutral hooks to React (`data-active` on both painter buttons,
  `data-pptx-viewport` on the viewport), gave demo-vue a `#file-input` drop-zone, and
  made the runner multi-project. Aligned the Vue edit canvas to React's
  **authored-size + scrollable** model (dropped the auto-`fitScale`) and fixed mobile
  layout (hide desktop rail < 768px, flex bottom-bar, responsive demo header) so
  position-based touch specs match. 1207 vue unit tests still green; typecheck/lint/fmt
  clean; build green, dist self-contained. **Next: phase 4 — adopt Tailwind in the Vue
  chrome for utility-for-utility visual parity with React.**

- **2026-06-18** — Slide-render fidelity: **font sizes were rendered in `pt`,
  not `px`**. `element-style.ts` (`getTextBlockStyle`) and `ElementRenderer.vue`
  (`segmentStyle`) emitted `${fontSize}pt`, inflating every glyph by ~1.33×
  (96/72) versus React, which renders the parsed size as a unitless CSS px value
  (so does the inline editor). On the sample deck this pushed the two-line title
  out of its box and over the subtitle. Fixed to `px`; also added the missing
  **line-height** (default 1.25 / `lineSpacing` / `lineSpacingExactPt`) and
  **body-inset padding** (0.1″ L/R, 0.05″ T/B) to mirror React's
  `getTextStyleForElement`. Verified live against the React demo (title run
  54px↔54px, line-height 1.25, insets 9.6/4.8px) — slide 1 now matches React.
  New **framework-agnostic** e2e `e2e/text-rendering.spec.ts` asserts the
  authored px sizes (54/20/16 on slide 1) off the neutral `[data-pptx-element]`
  contract + that the title fits its box; passes on **react/vue/angular**. 1209
  vue unit tests green; vue typecheck clean. Connector/presenter text paths keep
  `pt` deliberately — React's own `ConnectorTextOverlay` uses `pt` there, so they
  already match. **Observed next visual-parity targets** (from the live React↔Vue
  diff): slide 2 bulleted lists render no bullet glyphs/indents in Vue
  (`ElementRenderer` paragraph loop ignores `bulletInfo`/`paragraphIndents`), and
  the editor **chrome** is a compact two-row toolbar vs React's full Office-style
  ribbon (File/Home/Insert/… tabs, Font/Paragraph groups, status bar).

- **2026-06-18** — Table-cell text invisible on light tables. Body cells with no
  explicit text colour (no cell-style colour, band/header emphasis, or per-run
  colour) inherited the dark-UI chrome `foreground` (near-white `#f3f4f6`) and
  vanished on the sample deck's "Plans" table (the banded rows were unreadable).
  React resolves such cells to `DEFAULT_TEXT_COLOR` (`#111827`); `TableRenderer.vue`
  now applies the same fallback after layering band + cell styles, so header cells
  keep their explicit white and body cells render dark. Verified live: header
  `rgb(255,255,255)`, body `rgb(17,24,39)` — exact match with React. +2 table unit
  tests (1211 vue total green); typecheck clean. _Note for the chrome work:_ the
  near-white default is a latent risk anywhere slide text lacks a resolved colour —
  the real root is that slide content inherits the chrome `--pptx-foreground`; a
  future hardening is to set a dark slide-content text base on `SlideStage` so this
  can't recur per-renderer.
  **Also confirmed shared (non-parity) core bug:** `&` renders as literal `&amp;`
  in slide text (double-encoding) on **both** React and Vue — a `pptx-viewer-core`
  text-decoding issue, not a binding gap; left for a core fix.

- **2026-06-18** — **Office-style ribbon toolbar** (`components/ribbon/`). Replaced
  the compact two-row `EditorToolbar` with a faithful port of React's ribbon chrome
  (`components/Toolbar.tsx` + `toolbar/*`, ~5.5k LOC). New `ribbon/`: `ribbon-constants.ts`
  (verbatim Tailwind tokens + data tables; JSX icon arrays → `lucide-vue-next`
  component refs), `ribbon-types.ts` (UI enums + the `RibbonProps` contract mirroring
  `ToolbarProps`), `use-dropdown.ts` (open-state + outside-click composable replacing
  each section's React `useState`+`useEffect`), the `RibbonToolbar.vue` shell +
  `ToolbarPrimaryRow.vue` + all 13 tab sections + ModeSwitcher/PresentDropdown/
  OverflowMenu/CustomShowsControls. Sections were ported by 8 parallel subagents
  against the scaffold (callbacks as function props, `react-icons/lu`→Lucide minus the
  `Lu` prefix, i18n keys→English literals), integrated centrally. **Added
  `lucide-vue-next`** (externalised dep — the Vue equivalent of React's `react-icons`).
  Host wiring: a `ribbonProps` computed in `PowerPointViewer.vue` adapts the existing
  state + handlers (undo/redo, zoom, insert text/shape/smartart/equation, clipboard,
  format-painter, align, delete/duplicate/layer, find, comments, inspector toggle,
  present, export, sorter, a11y, settings, master view, custom shows, doc properties,
  version history) to `RibbonProps`. **Verified live against the React demo** — primary
  row, full tab bar (File…Help), Home (Clipboard/Slides/Font/Paragraph) and Insert
  (Text/Shape/Image/Media/Table/SmartArt/Equation/Action) sections match; tab switching
  - active-tab underline work. 1211 vue unit tests green (edit-wiring smoke test updated
    for the ribbon); typecheck + oxlint clean; **format-painter + text-rendering e2e green
    on vue** (the `format-painter-toggle` hook now lives in the ribbon's Home tab).
    **Interim / follow-ups:** the old `<header>` + `EditorToolbar` + `AlignToolbar` are
    disabled (`v-if="false"`) rather than deleted — they still carry the **slide
    prev/next nav**, which React keeps in a **bottom status bar** that isn't ported yet;
    next step is to port the status bar (slide counter + nav + zoom + view toggles), then
    delete the dead header. No-op ribbon stubs awaiting host capability: drawing tools,
    grid/ruler/snap, theme gallery, flip, action buttons, image/media picker, table insert,
    layout gallery, spell-check, guides, transitions controls. The left slides rail still
    shows the old `Add`/`Duplicate` + Transition panel (vs React's plain thumbnail rail).

- **2026-06-18** — **Bottom status bar** (`components/StatusBar.vue`, Vue port of
  React's `StatusBar.tsx`). Slide counter + language + autosave status on the left;
  Notes toggle + view-mode buttons (Normal / Slide Sorter / Slide Show) + zoom controls
  on the right (classes verbatim; Lucide icons; English literals). Wired into
  `PowerPointViewer.vue` below the body (`v-if="!isMobile"`): zoom reuses the existing
  handlers, the view buttons drive present/sorter, and a new `notesExpanded` ref lets the
  Notes toggle collapse the desktop `NotesPanel`. **The desktop chrome is now
  ribbon-on-top + status-bar-on-bottom, matching React** (verified live). Confirmed that
  React keeps **no slide nav in the toolbar** either (thumbnails + keyboard), so the
  disabled header's loss of prev/next is parity-correct. +6 StatusBar unit tests (1217
  vue total green); typecheck + oxlint clean. **Remaining chrome cleanup:** the disabled
  `<header>` / `EditorToolbar` / `AlignToolbar` blocks can be deleted once group/ungroup/
  distribute (currently only surfaced by the disabled `AlignToolbar`) get a ribbon home or
  are intentionally dropped; that also removes the orphaned `ExportMenu`/`AutosaveIndicator`
  imports.
