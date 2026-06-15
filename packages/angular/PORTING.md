# Porting `pptx-viewer` (React) → `pptx-angular-viewer` (Angular)

> **Living document.** Update the status tables as you port. This is the
> hand-off contract between sessions and the Angular sibling of
> [`packages/vue/PORTING.md`](../vue/PORTING.md). Keep it accurate — future
> sessions trust it instead of re-scanning the ~100k-line React package.

## Goal

Ship an Angular package, **`pptx-angular-viewer`** (npm), that is a
feature-equivalent counterpart to the React `pptx-viewer` package
(`packages/react`) and the Vue `pptx-vue-viewer` package (`packages/vue`). All
three wrap the framework-agnostic `pptx-viewer-core` engine and share
cross-framework logic via **`pptx-viewer-shared`**.

## Tooling

| Concern       | Choice                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Angular       | **22.x** (latest) — standalone components, signals, native control flow (`@if`/`@for`)                                   |
| TypeScript    | `^6.0.3` (matches the monorepo; Angular 22 / ng-packagr 22 peer-depend on TS `>=6.0 <6.1`)                               |
| Library build | **ng-packagr** → Angular Package Format (partial-Ivy FESM + d.ts) in `dist/`                                             |
| Unit tests    | **vitest** (happy-dom) for the pure helpers; component/TestBed tests via `@analogjs/vite-plugin-angular` are a follow-up |
| Demo          | `demo-angular/` — Vite + `@analogjs/vite-plugin-angular` (mirrors the React `demo/`)                                     |

## Conventions (React / Vue → Angular)

| React                                | Vue                     | Angular                                                                   |
| ------------------------------------ | ----------------------- | ------------------------------------------------------------------------- |
| Custom hook `useXxx`                 | Composable `useXxx`     | Injectable **service** with signals (e.g. `LoadContentService`)           |
| `useState`                           | `ref` / `shallowRef`    | `signal()`                                                                |
| `useMemo`                            | `computed`              | `computed()`                                                              |
| `useEffect(fn, [deps])`              | `watch` / `watchEffect` | `effect()` (+ `DestroyRef.onDestroy` for cleanup)                         |
| `createContext` + `useContext`       | `provide` / `inject`    | `InjectionToken` + `providers` (see `provideViewerTheme`)                 |
| `forwardRef` + `useImperativeHandle` | `defineExpose`          | Public methods on the component (reach via template ref / `viewChild`)    |
| Function-prop callbacks (`onX`)      | `defineEmits` events    | `output()` events                                                         |
| `.tsx` component                     | `.vue` SFC              | `@Component` standalone, inline template                                  |
| `React.memo`                         | (Vue reactivity)        | `ChangeDetectionStrategy.OnPush` + signals                                |
| Tailwind utility classes             | hand-written scoped CSS | hand-written CSS scoped under `.pptx-ng-viewer` (Tailwind optional later) |

## Shared-code extraction — **`pptx-viewer-shared`** ✅ (in progress, landed)

The high-leverage win: framework-agnostic logic that used to be duplicated in
`packages/react` (and copied again into `packages/vue`) now lives once in
[`packages/shared`](../shared) (`pptx-viewer-shared`). Every binding imports
one copy.

**Already moved (React + Vue repointed to re-export shims; all green):**

| Module                           | Shared location                   | Notes                                                                                                         |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Theme types / palette / css-vars | `pptx-viewer-shared` (`./theme`)  | `ViewerTheme`, `ViewerThemeColors`, `defaultThemeColors`, `defaultRadius`, `themeToCssVars`, `defaultCssVars` |
| Load-pipeline helpers            | `pptx-viewer-shared` (`./loader`) | `collectMediaElements`, `collectImagePaths`, `buildInitialGuides`, `GuideEntry`, `ImagePathElement`           |
| Public viewer types              | `pptx-viewer-shared`              | `CanvasSize`, `CollaborationConfig`, `CollaborationRole`                                                      |
| Scalar viewer defaults           | `pptx-viewer-shared`              | `DEFAULT_CANVAS_WIDTH/HEIGHT`, `DEFAULT_TEXT/FILL/STROKE_COLOR`                                               |

> `pptx-viewer-shared` is a **private, non-published** package (`"private": true`).
> It is **inlined** into each binding — by tsup/vite for React/Vue, and for
> Angular by **vendoring its source at build time** (`scripts/inline-shared.mjs`
> copies `packages/shared/src` → `src/internal/shared-src`, a git-ignored dir, so
> ng-packagr compiles it as local source). It therefore never appears in any
> published `package.json`. `pptx-viewer-core` stays an external **peer** (it is
> a published package) so the host app dedupes a single engine.

**Strong remaining extraction candidates** (pure `.ts`, still in
`packages/react/src/viewer/utils`):

- `color-core.ts`, `color-gradient.ts`, `color-patterns.ts`, `color.ts`
- `geometry*.ts`, `resolved-shape-clip-path.ts` (shape path generation)
- `connector-router*.ts`, `connector-reroute.ts`
- `animation-*.ts` (timeline / sequencer / keyframes / presets — the engine, not JSX)
- `morph-*.ts`, `warp-path-*.ts`, `latex-to-omml*.ts`, `omml-*.ts`
- `table-merge-core.ts`, `table-selection-utils.ts`
- `image-effects.ts`, `duotone-effects.ts`, `effect-dag-filters.ts`
- `clone.ts`, `compare.ts`, `generate-id.ts`, `hyperlink-security.ts`,
  `unicode-script-detection.ts`, `kinsoku-styles.ts`, `tab-leader.ts`
- `element-style.ts` logic (only the return-type/CSS-map shape differs per
  framework — a neutral core could be hoisted)

> ⚠️ Each extraction touches `packages/react` imports — do it as its own
> focused, verified change (build shared → repoint via shims → typecheck React +
> Vue + Angular). Coordinate with the React/Vue sessions.

## Directory mapping

```
packages/react/src/                          packages/angular/src/
  index.ts                                     public-api.ts                        ✅
  utils.ts (cn)                                utils.ts                             ✅
  theme/{types,defaults,css-vars}.ts           → pptx-viewer-shared                 ✅ (moved)
  theme/context.tsx (createContext)            theme/viewer-theme.ts (InjectionToken) ✅
  lib/canvas-export.ts                          —  (TODO)
  viewer/PowerPointViewer.tsx                  viewer/power-point-viewer.component.ts ◑ viewer-first
  viewer/components/SlideCanvas.tsx            viewer/slide-canvas.component.ts     ◑ basic
  viewer/components/ElementRenderer.tsx        viewer/element-renderer.component.ts ◑ basic
  viewer/hooks/useLoadContent.ts               viewer/load-content.service.ts       ◑ viewer-first
  viewer/hooks/load-content-helpers.ts         → pptx-viewer-shared                 ✅ (moved)
  viewer/utils/* (style subset)                viewer/element-style.ts              ◑ tiny subset
  viewer/constants/scalar.ts                   → pptx-viewer-shared + constants.ts  ✅ (subset)
  viewer/types-ui.ts                           viewer/types.ts (+ shared)           ◑ public subset
  viewer/components/{toolbar,inspector,...}    —                                    ☐ TODO
  styles/pptx-viewer.css (Tailwind)            styles/pptx-angular-viewer.css       ◑ hand-written
```

Legend: ✅ done · ◑ partial/basic · ☐ not started

## Status by area

### Foundation

| Item                                                             | Status | Notes                                                                                               |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Package scaffold (ng-packagr, tsconfig.lib, vitest)              | ✅     | Builds to Angular Package Format; `bun run --filter pptx-angular-viewer build/typecheck/test` green |
| `cn` utility                                                     | ✅     | dependency-free (Angular uses scoped CSS, not Tailwind classes)                                     |
| Theme (`VIEWER_THEME` token, `provideViewerTheme`, `themeStyle`) | ✅     | consumes `pptx-viewer-shared`                                                                       |
| Public types                                                     | ◑      | viewer-first subset; shared types re-exported                                                       |
| Base CSS                                                         | ◑      | hand-written chrome under `.pptx-ng-viewer`, exposed as `pptx-angular-viewer/styles`                |

### Load / state

| Item                                                                                                                                           | Status | Notes                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LoadContentService`                                                                                                                           | ◑      | parses via `PptxHandler`; resolves image/media Blob URLs; `getContent()`. Populates **slides, canvasSize, theme, slideMasters, mediaDataUrls** only. |
| Full viewer state (sections, customShows, embeddedFonts, header/footer, notes/handout masters, signatures, macros, guides, tags, doc props, …) | ☐      | ~25 extra fields the React hook sets; add as features need them                                                                                      |
| Editor history (undo/redo)                                                                                                                     | ☐      |                                                                                                                                                      |
| Editor operations (element CRUD/transform)                                                                                                     | ☐      |                                                                                                                                                      |
| Export / autosave / clipboard / find-replace / comments                                                                                        | ☐      |                                                                                                                                                      |

### Rendering

| Item                                                     | Status | Notes                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PowerPointViewerComponent` (load + nav + zoom)          | ◑      | loading/error/encrypted states, prev/next, zoom, thumbnail rail; `activeSlideChange` output                                                                                                                                                                                                                                                                                    |
| `SlideCanvasComponent`                                   | ◑      | scaled stage + element list + full slide background (image → gradient → pattern base → solid, via `slide-background.ts`); no rulers/grid/guides/overlays                                                                                                                                                                                                                       |
| `ElementRendererComponent`                               | ◑      | renders all 11 element types (text/shape, connector, chart, table, smartArt, ink, ole, model3d, zoom, picture/image, media, group); sanitized text hyperlinks (`hyperlink.ts`)                                                                                                                                                                                                 |
| `element-style.ts`                                       | ◑      | container/shape/text/image basics; fill cascade image → pattern → gradient → solid (structured `color-gradient.ts` + OOXML `color-patterns.ts`); preset-geometry clip-paths (`shape-geometry.ts`); shadows/glow/reflection (`visual-effects.ts`)                                                                                                                               |
| Rich text runs (bold/italic/underline/strike/color/size) | ◑      | per-segment spans, paragraph + line breaks (text/shape + table cells); bulleted/numbered lists via `text-bullets.ts` (char/auto-number markers + per-level indent)                                                                                                                                                                                                             |
| Connectors (SVG)                                         | ◑      | `ConnectorRendererComponent` — straight + bent (elbow) + curved (Bézier) routing via `connector-path.ts` (pure TS); stroke colour/width/dash + arrowheads, flip baked into endpoints. Full A\* routing, compound lines, connector text: TODO                                                                                                                                   |
| Tables                                                   | ◑      | `TableRendererComponent` — `<table>` with merged cells (colspan/rowspan), column widths/row heights, per-cell solid/gradient fill + borders, and rich text (cell-level style, paragraph/line breaks). Per-run cell segments (needs core), editing: TODO. View-model in `table-renderer-helpers.ts` (pure TS)                                                                   |
| Charts (SVG)                                             | ◑      | `ChartRendererComponent` — inline SVG for bar/column, line/area, pie/doughnut, scatter, **bubble** (3rd-series sizing), **radar/radar3D** (polar rings/spokes/polygons via `SvgPolygon`); value scaling, per-series colours, legend; unsupported kinds → labelled fallback. Geometry in `chart-renderer-helpers.ts` (pure TS). combo/stock/surface/treemap/waterfall/etc: TODO |
| SmartArt                                                 | ◑      | `SmartArtRendererComponent` — authored drawing-shapes (rect/ellipse/roundRect + rotated text); when absent, a family layout fallback (list/process/cycle/hierarchy, positioned nodes + connectors) via `smart-art-layouts.ts`; stacked-text last resort. Logic in `smart-art-renderer-helpers.ts` (pure TS)                                                                    |
| Ink / OLE / Model3D / Zoom                               | ◑      | `InkRendererComponent` (SVG strokes), `OleRendererComponent` (preview image / type icon + badge), `Model3DRendererComponent` (poster/placeholder — no three.js), `ZoomRendererComponent` (slide/section thumbnail). Each with a pure-TS `*-helpers.ts`                                                                                                                         |
| Preset-geometry clip-paths                               | ◑      | `shape-geometry.ts` (`getResolvedShapeClipPath`) — core geometry-engine cascade (adjustment-aware → preset evaluator → cloud bezier → static polygon); wired into `element-style.ts`                                                                                                                                                                                           |
| Shadows / glow / reflection / image-effect filters       | ◑      | `visual-effects.ts` (`getComputedEffectStyle`) — outer/inner/glow shadows, blur/soft-edge filters, reflection, blend mode, effect-DAG alpha; wired into `element-style.ts`. Duotone SVG `<filter>` injection deferred                                                                                                                                                          |
| Structured gradients, pattern fills                      | ◑      | local pure-TS ports `color-gradient.ts` (linear/radial/circle/rect/shape) + `color-patterns.ts` (all 52 OOXML presets); wired into `element-style.ts`. Extraction to `pptx-viewer-shared` still a future refactor                                                                                                                                                              |
| Text warp / WordArt, equations (OMML→MathML)             | ☐      | Vue has an equation renderer to mirror                                                                                                                                                                                                                                                                                                                                         |

### Viewer features

| Item              | Status | Notes                                                                                                                                                   |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation mode | ◑      | `PresentationOverlayComponent` — fullscreen fit-to-screen slideshow, keyboard + click nav skipping hidden slides, counter. Animations/transitions: TODO |
| Slide sorter      | ◑      | `SlideSorterOverlayComponent` — responsive grid of live slide-preview thumbnails; click to jump                                                         |
| Speaker notes     | ◑      | toggleable notes strip in `PowerPointViewerComponent`                                                                                                   |
| Find in slides    | ◑      | `FindBarComponent` + `slide-search.ts` — text search across all slides (text/table/smartArt/group/notes) with prev/next navigation. Replace: editor     |

| Export (PNG / PDF) | ◑ | `ExportService` + ported `lib/canvas-export.ts` (html2canvas-pro wrapper with modern-CSS-colour + backdrop/blend/3D preprocessing) + `jspdf`; PNG (current slide) and PDF (all slides) toolbar buttons. Matches React's deps (auto-installed via `dependencies`, allowed in ng-package.json). GIF/video: TODO |

### Editor foundation (◑ — services landed; interaction UI next)

| Item                                            | Status | Notes                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Undo/redo history                               | ◑      | `editor-history.ts` — generic `EditorHistory<T>` snapshot stacks with labels + depth cap (mirrors `useEditorHistory`)                                                                                                                                                                                                                  |
| Element operations                              | ◑      | `element-operations.ts` — pure immutable update/move/resize/delete/duplicate/z-order (mirrors `useElementOperations`)                                                                                                                                                                                                                  |
| Editor state service                            | ◑      | `EditorStateService` — editable slides signal + selection + dirty + ops that record history; undo/redo restore snapshots                                                                                                                                                                                                               |
| **Interaction UI**                              | ◑      | click/shift-click + **marquee** select; **drag-move, 8 resize handles, rotation handle** (`drag-resize.ts`, one undo entry per gesture); **inline text edit** (double-click); keyboard (Delete, Ctrl+Z/Y/D/C/X/V/A/G, arrow-nudge ×10); editable deck + Undo/Redo; edits persist through `getContent()`. Rulers/grid/snap-guides: TODO |
| **Inspector panel**                             | ◑      | `InspectorPanelComponent` — position/size/rotation/opacity, fill/stroke colour (shapes), text colour/size + B/I/U (text), arrange (z-order), duplicate/delete; commits one history entry per change. Readers/patch-builders in pure `inspector-helpers.ts`. Full React inspector (tabs, advanced fill, effects, animation): TODO       |
| Section / table operations, clipboard, autosave | ☐      | mirror `useSectionOperations` / `useTableOperations`                                                                                                                                                                                                                                                                                   |

### Editor chrome (◑ — substantial)

Landed: single-element **inspector panel**; **slides panel** (live previews +
add/duplicate/delete/reorder); **insert/arrange/align toolbar** (insert
text/rect/ellipse/line, duplicate/delete, z-order, align/distribute);
**right-click context menu** (cut/copy/paste/duplicate/delete/z-order);
**clipboard** (Ctrl+C/X/V); **inline text editing** (double-click); **align &
distribute** for multi-selection. Remaining: dialogs, mobile chrome,
accessibility panel, marquee/rotation handles, and the inspector's advanced
tabs (structured fill/gradient picker, effects, animation, text-advanced),
plus table/chart data editing. All build on the editor foundation.

### Advanced subsystems

Landed as signal-based services + standalone OnPush components (pure logic in
`*-helpers.ts`, colocated vitest tests; **not yet wired into
`PowerPointViewerComponent`** — exported from the barrel for host use and
incremental wiring):

| Subsystem                | Status | Notes                                                                                                                                                             |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comments                 | ◑      | `CommentsService` + `CommentsPanelComponent` + `comments-helpers` (add/remove/resolve; per-slide model, host writes back)                                         |
| Digital signatures       | ◑      | `SignaturesService` + `SignaturesPanelComponent` + `signatures-helpers` (status aggregation/formatting)                                                           |
| Accessibility            | ◑      | `AccessibilityService` + `AccessibilityPanelComponent` + `accessibility-helpers` (issue scan over slides, severity grouping)                                      |
| Font embedding/injection | ◑      | `EmbeddedFontsService` (managed `@font-face` `<style>`, object-URL lifecycle) + `embedded-fonts-helpers`                                                          |
| Animation playback       | ◑      | `AnimationPlaybackService` + `AnimationPanelComponent` + `animation-playback-helpers` (click-group steps, reveal/pending styles, rAF playback)                    |
| Collaboration (Yjs)      | ◑      | `CollaborationService` (Y.Doc + awareness, lazy `y-websocket`, degrades if absent) + `CollaborationCursorsComponent` + `collaboration-helpers` (presence/cursors) |
| Dialog suite             | ◑      | `ModalDialogComponent` base + Properties/Share/Hyperlink/Broadcast dialogs + per-dialog helpers (hyperlink reuses `./hyperlink` URL-safety)                       |
| Print                    | ◑      | `PrintService` + `PrintDialogComponent` + `PrintSettingsPanelComponent` + `print-helpers` (settings/layout/printable-markup; window.print)                        |
| Presentation transitions | ◑      | `transition-helpers` (slide-transition → CSS keyframes) + `PresentationTransitionOverlayComponent` (plays entering/leaving over the stage)                        |
| Presenter view           | ◑      | `presenter-view-helpers` (layout/timer/notes) + `PresenterViewComponent` (current+next slide, notes, elapsed timer, controls)                                     |

**Still ☐ — not started:** GIF/video export, find/**replace** (find-only is
done), table & chart data editing, the advanced inspector tabs (structured
gradient picker / effects / animation authoring), more chart kinds
(combo/stock/treemap/surface/waterfall — the Vue side is adding these;
bubble/radar landed), full A\*
connector routing, duotone SVG `<filter>` injection.

**Wired into `PowerPointViewerComponent`** (composed in the default
`<pptx-viewer>` chrome): **embedded fonts** (auto `@font-face` injection on
load), **comments** (toolbar toggle → editable side panel, when `canEdit`),
**accessibility** (toolbar toggle → side panel + jump-to-slide), **document
properties** ("Info" dialog + `propertiesChange` output), **hyperlink** ("Link"
dialog for the selection, when `canEdit`), **print** (toolbar button → dialog,
rasterising each slide off the live stage), and **collaboration** (connects on
the `collaboration` input + remote-cursor overlay). `LoadContentService` now
also surfaces `embeddedFonts` / `coreProperties` / `hasDigitalSignatures` /
`digitalSignatureCount`.

> **Wiring update (2026-06-16):** now composed into the default chrome —
> **signatures panel** (`LoadContentService` parses `_xmlsignatures/*.xml` into
> `ParsedSignature[]` via lazy jszip/fast-xml-parser + core `parseSignatureXml`;
> a `signatures` signal feeds a toolbar-toggled panel shown when the deck is
> signed); **share** + **broadcast** dialogs (toolbar buttons → CollaborationService
> connect); **presenter view** (toolbar button → fullscreen speaker overlay);
> **presentation transitions** (played in the presentation overlay on forward
> navigation). **Still not composed:** **animation playback** — the service,
> panel, and helpers are exported and tested, but composing them into the
> overlay needs a per-element style-override mechanism threaded through the
> universal `ElementRenderer` (affects all 11 element render paths) — a
> deliberate rendering-path change left as the single remaining wiring task.

## Demo

`demo-angular/` — Vite + `@analogjs/vite-plugin-angular`. Pick a `.pptx` file
and render it with `<pptx-viewer>`. Run:

```bash
bun run --filter pptx-angular-demo dev      # http://localhost:4174
bun run --filter pptx-angular-demo build    # production build
```

The demo aliases `pptx-angular-viewer` to its built `dist/` (Angular Package
Format), so **build the library first** (`bun run --filter pptx-angular-viewer build`).

## Open decisions / notes for next session

1. **Styling.** Hand-written scoped CSS today. If the editor chrome is ported
   wholesale, consider adopting the React Tailwind 4 pipeline to make the ~213
   components cheaper to port 1:1 (same decision as the Vue port).
2. **Component tests.** Add `@analogjs/vite-plugin-angular` + TestBed (or
   zoneless) vitest tests for the components. Pure helpers are covered now.
3. **Zoneless.** The viewer is OnPush + signals end-to-end, so it is a good
   candidate for `provideZonelessChangeDetection()` — the demo currently boots
   with `zone.js` for simplicity.
4. **Publishing.** `pptx-viewer-shared` is **private and never published** — its
   source is vendored/inlined into this library's FESM at build time (see the
   shared-code section above), so the published `dist/package.json` does **not**
   reference it. The only external runtime requirements are the `peerDependencies`:
   `@angular/*`, `rxjs`, and `pptx-viewer-core` (already published on npm).

   The library packs cleanly today (`bun run pack` → a valid tarball with no
   `workspace:*` leaks). The source keeps `pptx-viewer-core: workspace:*` like
   every other package; because ng-packagr publishes from `dist/` (not a
   workspace member, so `bun pm pack` can't resolve `workspace:*` there), a
   post-build step `scripts/finalize-dist.mjs` reads the workspace's current core
   version and rewrites the `dist/package.json` range to `^<version>`. So the
   peer tracks the workspace version automatically — no manual pinning.

   npm releases are now automated: `pptx-angular-viewer` has a `test-angular`
   CI job, is packed in the `release` job (patching `dist/package.json`'s
   version + `pptx-viewer-core` range to the release version before packing
   from `dist/`), attached to the GitHub release, and published to npm in the
   `publish` job. The core peer range is bumped in lockstep automatically.

   In-repo (build, demo, typecheck, test) everything resolves via the bun
   workspace symlinks + the build-time vendoring, so nothing here blocks
   development.

5. **Imperative API.** `getContent()` is a public method. If a richer handle is
   needed (matching the React `forwardRef` surface), expand the component's
   public methods rather than introducing a service-locator.

## Recommended next steps (priority order)

The viewer is now feature-rich: all 11 element types render with fills
(solid/gradient/pattern/image), clip-path geometry, shadows/glow/reflection,
bulleted/numbered lists, sanitized hyperlinks, and full slide backgrounds; plus
presentation mode, slide sorter, speaker notes, and find-in-slides. The next
frontier is **editing** and the remaining advanced subsystems.

1. **Editor foundation** (gates all editor chrome): port the full viewer state,
   editor history (undo/redo), and element CRUD/transform operations as
   signal-based services. Large — its own multi-step effort before any
   toolbar/inspector work.
2. **Export** (PNG/PDF): add `html2canvas-pro` + `jspdf` and an export service
   driven off the rendered slide stage. Self-contained, high user value.
3. Remaining render depth: more chart kinds (combo/stock/surface/treemap/waterfall;
   bubble/radar landed), full A\*
   connector routing, per-run rich text in table cells (needs a core
   extension), equations (OMML→MathML — Vue has a reference), duotone SVG
   `<filter>` injection, presentation transitions/animations.
4. Add component/TestBed tests (decision #2).
5. Extract the local pure-TS ports (`color-gradient`, `color-patterns`,
   `visual-effects`, `shape-geometry`, `text-bullets`) into `pptx-viewer-shared`
   to dedupe with React/Vue — coordinate with those sessions.

## Session log

- **2026-06-14** — Initial scaffold + viewer-first milestone. Created
  `pptx-viewer-shared` and moved theme + load-content-helpers + public viewer
  types + scalar constants there (React & Vue repointed to shims; shared/React/
  Vue builds, typechecks, and tests all green). Scaffolded `pptx-angular-viewer`
  on Angular 22 (ng-packagr, standalone + signals): `VIEWER_THEME` token +
  `provideViewerTheme`, `LoadContentService`, `PowerPointViewerComponent`,
  `SlideCanvasComponent`, `ElementRendererComponent` (text/shape/image/media/
  group + placeholders), `element-style.ts`, base CSS, `cn`, unit tests. Library
  builds + typechecks + tests green. Added `demo-angular/` (Vite + Analog) — full
  production build green. Repo relicensed MIT → Apache-2.0; Dependabot added.
- **2026-06-15** — Wired `pptx-angular-viewer` into the CI pipeline (it was
  built but never tested/released/published): added a `test-angular` job, gated
  `release` on it, and pack/publish from ng-packagr's `dist/` with the version +
  `pptx-viewer-core` peer range patched to the release version. Added image &
  gradient fill support to `element-style.ts` (`getShapeFillStrokeStyle`),
  mirroring the Vue port's fill resolution order (image → gradient via the
  parser's prebuilt CSS string → solid); +5 unit tests. Library build,
  typecheck, and all 13 tests green.
- **2026-06-15 (batch 2)** — Three new renderers via parallel subagents (each a
  self-contained new file, integrated centrally):
  `shape-geometry.ts` (preset-geometry clip-path cascade, wired into
  `element-style.ts`), `ConnectorRendererComponent` + `connector-path.ts`
  (straight SVG connectors with arrowheads), and `TableRendererComponent` +
  `table-renderer-helpers.ts` (`<table>` with merged cells, widths/heights,
  cell fill/border/text). Wired `connector`/`table` cases into
  `ElementRendererComponent`; exported the new surface from the barrels; added
  base table CSS. Pure logic extracted to helper modules so tests skip TestBed.
  Library build, typecheck, lint (`--deny-warnings`), and all 100 tests green.
- **2026-06-15 (batch 3)** — Three more renderer upgrades via parallel subagents:
  `ChartRendererComponent` + `chart-renderer-helpers.ts` (inline-SVG
  bar/line/area/pie/scatter charts, labelled fallback for unsupported kinds,
  wired as the `chart` case), rich-text table cells (cell-level style +
  paragraph/line breaks in `table-renderer-helpers.ts`), and bent/curved
  connector routing (`connector-path.ts` gains an optional `pathD`; the
  component renders `<path>` vs `<line>`). Library build, typecheck, lint
  (`--deny-warnings`), and all 209 tests green.
  > ⚠️ The shared-checkout hazard bit mid-batch: a parallel session reset the
  > working tree and wiped the (already-finished) connector subagent's edits
  > before the slower chart/table subagents returned. Recovery: commit surviving
  > work immediately, then redo the lost task by hand and commit fast. Lesson —
  > commit each completed unit ASAP; don't leave a wide window of uncommitted
  > subagent output in the shared tree.
- **2026-06-15 (batch 4)** — Completed the renderer surface for all 11 element
  types via 4 parallel subagents, each producing **only new files** (key hazard
  insight: `git checkout`-style resets revert tracked-file edits but leave new
  untracked files intact — so new files are reset-safe; the orchestrator does
  all tracked-file integration and commits fast). Landed: `visual-effects.ts`
  (`getComputedEffectStyle` — shadows/glow/reflection/filters, wired into
  `element-style.ts`), `SmartArtRendererComponent`, `InkRendererComponent`,
  `OleRendererComponent`, `Model3DRendererComponent`, `ZoomRendererComponent`
  (each + pure-TS `*-helpers.ts`). Wired all five `@case`s + the effects layer;
  trimmed the placeholder map to just `group`/`media`. Subagents read the Vue
  reference (newer than the local checkout) read-only via
  `git show origin/main:<path>`. Library build, typecheck, lint
  (`--deny-warnings`), and all 361 tests green.
- **2026-06-15 (batch 5)** — Viewer-completeness polish (orchestrator, no
  subagents): full slide background (`slide-background.ts` —
  `getSlideBackgroundStyle`, image → gradient → pattern base → solid, wired into
  `SlideCanvasComponent`; SVG pattern presets deferred), and sanitized text
  hyperlinks (`hyperlink.ts` — `resolveHyperlinkHref` blocks
  javascript/data/vbscript/mhtml + `ppaction://`; runs render as
  `<a target=_blank rel=noopener>`). +15 tests (376 total). Note: ng-packagr
  targets a lower `lib` than `tsconfig.lib.json` — `String.prototype.replaceAll`
  fails the build; use `.split(x).join('')` (typecheck passes but build is the
  real gate). Build, typecheck, lint, tests green.
- **2026-06-15 (parity waves 1–3)** — Team-of-agents push toward React parity;
  each subagent produced **only new files** (reset-safe), orchestrator did all
  tracked-file integration and committed each unit immediately:
  - Wave 1 (render depth): structured gradients (`color-gradient.ts`) + all 52
    OOXML pattern fills (`color-patterns.ts`) wired into the `element-style`
    fill cascade; SmartArt family layout fallback (`smart-art-layouts.ts` —
    list/process/cycle/hierarchy). A `chart-axes.ts` agent output was discarded
    (the chart helper already renders gridlines/axis labels).
  - Wave 2 (viewing experience): `PresentationOverlayComponent` (fullscreen
    slideshow), `SlideSorterOverlayComponent` (thumbnail grid), speaker-notes
    strip — wired into `PowerPointViewerComponent`.
  - Wave 3 (text + find): bulleted/numbered lists (`text-bullets.ts`) in the
    text renderer; find-in-slides (`slide-search.ts` + `FindBarComponent`).
    Test count 376 → **611**, all green. The renderer/viewer surface is now broad;
    the editor foundation is the main remaining gap (see next steps).
- **2026-06-15 (parity waves 4–6)** — Continued the team push:
  - Wave 4: math **equations** (`omml-to-mathml.ts` + `EquationRendererComponent`,
    inline MathML via sanitizer bypass), wired into the text renderer.
  - Wave 5: **export** — ported `lib/canvas-export.ts` (html2canvas-pro wrapper)
    - `ExportService` / `export-helpers` + `jspdf`; added html2canvas-pro & jspdf
      as Angular-package deps (matching React) allowed via
      `allowedNonPeerDependencies` in ng-package.json; PNG/PDF toolbar buttons.
  - Wave 6: **editor foundation** — `editor-history.ts` (generic undo/redo),
    `element-operations.ts` (pure transforms), `EditorStateService` (signal
    state + selection + history), then the **interaction UI**: click-select +
    selection outlines in SlideCanvas, keyboard editing (Delete/undo/redo/
    duplicate/arrow-nudge) in PowerPointViewer, editable deck + Undo/Redo
    buttons when `canEdit`, and save-back so edits persist through
    `getContent()`. The editor is now usable end-to-end (select → edit →
    undo → save); drag/resize handles and the editor chrome (toolbar/
    inspector/dialogs) are the remaining phases.
    Test count 611 → **915**, all green. The lib-target rule still bites (no
    `replaceAll` / named-capture-groups; one ASCII-CSS-regex file carries a
    justified `eslint-disable`, mirroring React).
- **2026-06-15 (editor waves)** — Built a working editor on the foundation:
  interaction UI (click-select + outlines, keyboard editing, undo/redo buttons,
  save-back through `getContent()`), then **drag-to-move + resize handles**
  (`drag-resize.ts`; one undo entry per gesture via `beginTransform`/
  `applyTransform`), then the **inspector panel** (`InspectorPanelComponent` +
  `inspector-helpers.ts`: position/size/rotation/opacity, fill/stroke/text
  colour, B/I/U, z-order, duplicate/delete). The editor is now usable
  end-to-end: select → drag/resize/edit-properties → undo/redo → save. Test
  count 915 → **953**. Remaining chrome: formatting toolbar, slide CRUD pane,
  dialogs, advanced inspector tabs.
- **2026-06-15 (editor chrome)** — Built out the editor chrome on the
  foundation: slide CRUD + element insert in `EditorStateService`; **slides
  panel** (live previews + add/duplicate/delete/reorder); **insert/arrange/align
  toolbar**; **inline text editing** (double-click → textarea overlay);
  **clipboard** (cut/copy/paste, Ctrl+C/X/V); **right-click context menu**;
  **align & distribute** (`align-distribute.ts` + toolbar). The editor now
  covers selection, direct manipulation, text editing, clipboard, slide
  management, insert, arrange, align, and undo/redo/save. Test count 953 →
  **996**. Remaining: dialogs, marquee/rotation handles, advanced inspector
  tabs, table/chart data editing, mobile/a11y chrome, collaboration.
- **2026-06-15 (direct manipulation complete)** — Rounded out the editor's
  direct-manipulation surface: **rotation handle**, **marquee** rubber-band
  multi-select, **group/ungroup** (`group-ops.ts` + toolbar + Ctrl+G), and
  select-all / clipboard / group keyboard shortcuts. The editor now supports
  full WYSIWYG editing — select (click/shift/marquee) → move/resize/rotate/
  inline-edit → cut/copy/paste, align/distribute, group, z-order → undo/redo →
  save. Test count 996 → **1017**.
- **2026-06-15 (editor polish)** — **Alignment snap guides** while dragging
  (`snap-guides.ts` — snap edges/centres to nearby elements, draw guide lines)
  and **slide property editing** (`EditorStateService.updateSlide` + a
  slide-properties panel for background colour + notes when nothing is
  selected). Test count 1017 → **1048**.
- **2026-06-15 (advanced-subsystem waves 1–2)** — Team-of-agents push to close
  the advanced-subsystem gap; each subagent produced **only new files**
  (reset-safe), orchestrator wired the barrel + fixed integration and committed
  each wave:
  - Wave 1: **comments**, **digital signatures**, **accessibility**, **embedded
    fonts** (`@font-face` injection), **animation playback** — each a
    signal-based service + (where applicable) a standalone OnPush panel +
    `*-helpers.ts` + colocated tests. Test count 1048 → **1172**.
  - Wave 2: **collaboration (Yjs)** (Y.Doc/awareness, lazy `y-websocket`,
    cursors component), **dialog suite** (`ModalDialog` base + Properties /
    Share / Hyperlink / Broadcast), **print** (`PrintService` + dialog +
    settings panel + layout/markup helpers), **presentation transitions**
    (slide-transition → CSS keyframes + overlay) and **presenter view**
    (current+next + notes + elapsed timer). Test count 1172 → **1421**.
  - Integration fixups: `CollaborationRole` is `'owner' | 'collaborator' |
'viewer'` (no `'broadcaster'`); renamed the hyperlink dialog's `save()`
    method to `apply()` to avoid colliding with its `save` output. typecheck,
    build (ng-packagr), and lint (`--deny-warnings`) all green.
  - All landed as exported services/components.
- **2026-06-15 (subsystem wiring)** — Composed the advanced subsystems into the
  default `<pptx-viewer>` chrome (orchestrator, single tracked component):
  `LoadContentService` now surfaces `embeddedFonts` / `coreProperties` /
  signature count+flag; `EmbeddedFontsService` auto-injects `@font-face` on
  load; toolbar gained **A11y** / **Comments** (canEdit) / **Info** / **Print** /
  **Link** (canEdit + selection) buttons feeding right-docked panels
  (accessibility + comments) and dialogs (properties + hyperlink + print);
  collaboration connects on the `collaboration` input and overlays remote
  cursors; added a `propertiesChange` output. Comments/hyperlink edits go
  through the editor (one history entry each). typecheck, build (ng-packagr),
  1421 tests, and lint (`--deny-warnings`) all green. Still unwired: signatures
  panel (needs a parts-reading handler API), animation/presenter/transition
  layers, and share/broadcast dialogs.

- **2026-06-16** — Chart-kind depth (orchestrator, no subagents): added
  **bubble** (scatter dots sized by an optional 3rd series via
  `computeBubbleRadius`, routed through the cartesian builder) and
  **radar/radar3D** (new polar `buildRadarViewModel` — concentric gridline
  rings, axis spokes, perimeter category labels, per-series filled polygons +
  vertex dots). Introduced an `SvgPolygon` view-model primitive (new template
  `@case` with `stroke-dasharray` for ring gridlines) and `dominant-baseline`
  on the category-label loop for centred radar labels. Pure geometry helpers
  (`computeBubbleRadius`/`radarAngle`/`computeRadarPoints`/`radarRingPoints`)
  unit-tested without TestBed. Mirrors React `chart-scatter-bubble.tsx` /
  `chart-radar.tsx`. Typecheck, build (ng-packagr), lint (`--deny-warnings`),
  and all **1440** tests green.

- **2026-06-16 (parity push — team of subagents)** — Closed nearly all
  remaining React-parity gaps. Each subagent produced **only new files**
  (reset-safe); the orchestrator did all tracked-file integration, ran
  typecheck + build (ng-packagr) + lint (`--deny-warnings`) + the full vitest
  suite, and committed each unit. Test count **1440 → 1850**.
  - **Render depth:** 6 new chart kinds (combo, stock, surface, treemap,
    waterfall, regionMap) wired into `resolveChartKind`/`buildChartViewModel`;
    **A\* connector routing** (`connector-routing.ts`) threaded SlideCanvas →
    ElementRenderer → connector (obstacles from sibling elements); **connector
    text overlay**; **duotone** SVG `<filter>` injection
    (`duotone-filter.ts` + `<defs>` in `ElementRenderer`, `element-style`
    keeps the `url(#…)` ref).
  - **Editor:** advanced inspector tabs (gradient picker, effects,
    text-advanced) + **table & chart data editing** as collapsible inspector
    sections; **find & replace** (`find-replace-helpers` +
    `FindReplaceBarComponent` + `EditorStateService.applyReplacement`).
  - **Export:** **GIF** (pure GIF89a encoder) + **WebM** (MediaRecorder)
    toolbar buttons in `ExportService`.
  - **Subsystem wiring:** signatures panel (parts-reading in
    `LoadContentService`; added `jszip`/`fast-xml-parser` deps), share +
    broadcast dialogs, presenter view, presentation transitions in the overlay.
  - **Deferred:** animation playback composed into the overlay (needs a
    per-element style-override path through the universal `ElementRenderer`).

> **Parity summary (updated 2026-06-16).** The Angular **viewer** matches
> React's viewing surface (all 11 element types, fills/effects/clip-paths/
> backgrounds, lists, hyperlinks, equations; presentation mode with **slide
> transitions**, slide sorter, **presenter view**, notes, find, PNG/PDF/**GIF**/
> **WebM** export, duotone `<filter>` injection). **Charts** now cover bar/column,
> line/area, pie/doughnut, scatter, **bubble, radar, combo, stock, surface,
> treemap, waterfall, regionMap**. **Connectors** do straight/bent/curved plus
> **A\* obstacle-avoiding routing** and **connector text**. The **editor** is a
> complete WYSIWYG editor (selection, move/resize/rotate with snap guides, inline
> text, clipboard, align/distribute, group, z-order, slide CRUD + properties,
> insert, inspector with **advanced tabs** — structured gradient picker, effects,
> text-advanced — **table & chart data editing**, toolbar, context menu,
> **find & replace**, undo/redo, save). **Advanced subsystems** are ported AND
> wired into the default chrome: comments, **digital signatures** (parts-read),
> accessibility, embedded fonts, collaboration/Yjs with **share & broadcast**
> dialogs, the dialog suite, print, presentation transitions, presenter view.
> **Still ☐ for full React parity** — **animation playback** composed into the
> presentation overlay (service/panel/helpers are ported & exported; needs a
> per-element style-override path through `ElementRenderer`), the inspector's
> **animation authoring** tab, and mobile/a11y chrome.
