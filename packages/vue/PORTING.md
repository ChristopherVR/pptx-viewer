# Porting `pptx-viewer` (React) → `pptx-vue-viewer` (Vue 3)

> **Living document & hand-off contract.** Keep it accurate; future sessions
> trust it instead of re-scanning the ~100k-line React package. Per-batch detail
> lives in git history; this file tracks **what's done vs. what's left for parity**.

## Goal

Ship a Vue 3 package, **`pptx-vue-viewer`** (npm), feature-equivalent to the React
`pptx-viewer` package (`packages/react`). Both wrap the framework-agnostic
`pptx-viewer-core` engine and share `pptx-viewer-shared`. An Angular port
(`pptx-angular-viewer`) follows the same conventions in a parallel session.

## Status: **component- and feature-level parity is reached**

> **Correction (2026-07-02):** the blanket "full parity" claim below overstated a
> few dialog / panel / overlay surfaces that were actually still stubbed. Those
> gaps are now closed (see _Recently closed_ immediately below); the historical
> prose is kept for context but should be read through that lens.

> **Recently closed (2026-07-02): dialog / panel / overlay parity pass.**
> Ported the remaining chrome that was threaded-but-inert or missing:
>
> - **Set Up Slide Show** (`SetUpSlideShowDialog.vue` + `ShowSlidesFieldset.vue`
>   - `ShowOptionsFieldset.vue`): show type / slide range / advance mode / loop /
>     narration / animation / subtitles / pen colour. `presentationProperties` is
>     now parsed in `useLoadContent` and forwarded to `handler.save`, so settings
>     round-trip. Wired via `onOpenSetUpSlideShow`.
> - **Selection Pane** (`SelectionPane.vue`): object list with visibility toggle
>   and drag z-order over the active slide's elements, routed through
>   `useEditorOperations` (`updateElement { hidden }` / `reorder`). Wired via
>   `onToggleSelectionPane` + `isSelectionPaneOpen`.
> - **Password protection** (`PasswordProtectionDialog.vue`) and **font
>   embedding** (`FontEmbeddingPanel.vue`), matching React's host-state model
>   (`usedFontFamilies` computed on the deck). Wired via `onOpenPasswordProtection`
>   / `onOpenFontEmbedding`.
> - **Keep-annotations-on-exit** (`KeepAnnotationsDialog.vue`): `PresentationMode`
>   prompts on exit when ink exists and emits the per-slide stroke map; the host
>   converts strokes via the shared `strokeToInkElement` (highlighter when
>   translucent) and appends `ink` elements per slide (one undoable batch).
> - **Action settings**: `HyperlinkDialog.vue` gained an action-type selector
>   (URL / go-to-slide / first / last / prev / next / end-show) via the core
>   `pptxActionToElementAction` / `elementActionToPptxAction`; on-canvas
>   `ActionButtonGlyphOverlay.vue` glyphs + `LinkTooltip.vue` render in
>   `ElementRenderer`.
> - **Comments**: on-canvas `CommentMarkersOverlay.vue` (numbered dots via shared
>   `getCommentMarkerPosition`) + threaded replies (`useComments.replyToComment`
>   nesting into `PptxComment.replies`, rendered/composed in `CommentsPanel.vue`).
> - **Slide sorter**: right-click context menu (reusing `ContextMenu.vue`:
>   duplicate / hide-show / delete) + keyboard shortcuts (Delete, Ctrl+D, Esc) +
>   hidden-slide badge.
> - **Minor**: `PresentationSettingsCard.vue` in `SlideInspector`,
>   `SignatureStatusBadge.vue` (signed-doc pill), and `SignatureStrippedDialog.vue`
>   (first-edit warning on a signed deck).

The Vue port covers essentially the full React surface (**1528 vue unit tests
green**, e2e green on react/vue/angular). Done and verified live:

- **Rendering**: every element type: text (rich runs), shapes (preset clip-path
  cascade, fill/stroke), images, tables (merges, banding, `tableStyleMap` GUIDs,
  pattern fills, rich cell text), charts (bar/line/area/pie + radar/scatter/bubble/
  waterfall/funnel/sunburst/treemap/combo/stock/histogram/boxWhisker **+ surface +
  regionMap + trendlines**), SmartArt (drawing-shapes + 10-family geometry
  fallback), connectors (straight/bent/curved/compound + text overlay), ink, OLE,
  equations (OMML→MathML), WordArt/text-warp, structured fills, shape effects
  (shadow/glow/soft-edge/reflection), shape 3D (approximate), image effects.
- **Editing**: select/drag/resize/rotate, align/distribute/group/flip/z-order,
  undo-redo, snap-to-grid, **snap-to-shape**, **H/V guides**, **rulers**, grid,
  **drawing/ink tools**, inline text editing, format painter, shape-adjustment handles.
- **Chrome**: full Office-style **ribbon** (all tabs, all actions wired), **status
  bar**, **slides rail** (React-parity), **inspector** (element + slide properties,
  incl. a full **SmartArt editing panel**: per-node text, add item / add sub-item,
  remove, promote/demote via Tab/Shift+Tab + buttons, reorder up/down, colour-scheme
  select, style toggle, and a layout switcher), context menu, dialogs. Tailwind 4
  pipeline adopted for visual parity.
- **Modes & I/O**: presentation mode (animation playback, presenter view, ink,
  rehearse timings, subtitles, slide transitions), export (PNG/PDF/GIF/WebM),
  print, **Save As** (pptx/ppsx/pptm), copy-slide-as-image.
- **Collab & docs**: Yjs collaboration (whole-doc + cursors + selection presence
  - follow-mode), comments, find/replace, autosave, version history/compare,
    accessibility panel, document properties (full round-trip), hyperlink/settings/
    insert-SmartArt/equation-editor dialogs, master views, header/footer, sections,
    custom shows, digital signatures, embedded fonts, mobile chrome, keyboard
    shortcuts, spell-check (native browser squiggles).

## ⏳ Remaining for parity

Everything below is **depth/fidelity**, not missing surface. Ordered roughly by
user-visible impact.

### Rendering fidelity

No known rendering-fidelity gaps remain vs React. The only differences are the
CSS-rendering approximations shared with React by design (`backdrop-filter` and
path gradients approximated on screen; some effects flatten in raster export),
documented in the root README.

> **Recently closed** (2026-06-27, second pass): **zoom target thumbnail**
> (`composables/zoom-target.ts` provide/inject feeds `ZoomRenderer.vue` the target
> slide's background, number, and section name, matching React's `ZoomSlideThumbnail`)
> and **shape `effectDag` duotone** (`DuotoneFilterDefs.vue` injects the shared
> `getDuotoneSvgFilter` markup; `element-style.ts` no longer strips the `url(#)` ref).
>
> **Recently closed** (2026-06-27): **real CSS-3D extruded faces**
> (`Extrusion3DOverlay.vue` + shared `build3DExtrusionData`, wired in
> `ElementRenderer.vue`) and **chart secondary / log / display-unit value axes**
> (shared `buildChartViewModel` → `chart/ChartViewModelSvg.vue`, with trendlines,
> error bars, and data tables) reached parity with React.

> **Recently closed** (2026-06-18): **bulleted lists** (`composables/bullet-list.ts`
>
> - `ElementRenderer.vue`: glyphs/auto-numbers/indents, parity-verified live),
>   **gradient tile-flip** (shared `fill-style.ts`), **text-warp envelope/simple
>   CSS-transform presets** (shared `text-warp.ts` + `WordArtText.vue`).
>
> **Not a gap, at parity:** "exotic equations" (`m:phant`/scaling) are deferred in
> **React too** (`omml-to-mathml.ts` has the identical case list), so this was never
> a Vue-vs-React gap.

### Editing / chrome depth

| Gap                            | Where                           | Notes                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Master/template editing**    | `onSetEditTemplateMode` (no-op) | Needs the edit-routing pipeline that sends edits to template/master elements (React gates pointer handlers on `editTemplateMode`). The flag stays a no-op until this lands; toggling it alone would mislead.                                                                             |
| **Slide-properties inspector** | `inspector/SlideInspector.vue`  | Background (colour/image/clear), transition (type/duration/advance + direction/orientation/spokes), and per-slide theme colour override (`clrMapOverride`) are done. Deferred: slide size (display-only, does not persist to save in React either) and the transition preview animation. |
| **`onToggleCompactToolbar`**   | ribbon                          | Trivial: currently has **no ribbon consumer**; wire a consumer or drop the prop. Not a real gap.                                                                                                                                                                                         |

### Infrastructure (not user-facing parity)

- **Fine-grained CRDT collaboration**: current model is whole-doc last-write-wins
  with presence/follow on top; conflict-resolving merge is the depth item.
- **Shared-code extraction**: pure framework-agnostic helpers should keep moving
  from `packages/vue/.../composables` into `pptx-viewer-shared/render` so React/
  Angular reuse them. Outstanding candidates: the vendored **GIF encoder** (each
  binding carries a copy), plus color/connector-router/animation-engine utils not
  yet hoisted. Internal dedup, not parity-blocking. See _Shared-code model_ below.

### Known cross-framework bug (not Vue-specific)

- **`&` renders as `&amp;`** in slide text (double-encoding) on **both** React and
  Vue: a `pptx-viewer-core` text-decoding issue. Fix belongs in core.

## Conventions (React → Vue 3)

Vue 3.5+, `<script setup lang="ts">` SFCs, Composition API. Mirror the React hook
architecture as composables so the packages stay easy to keep in sync.

| React                                  | Vue                                                                  |
| -------------------------------------- | -------------------------------------------------------------------- |
| `useXxx` hook returning values/setters | `useXxx` composable returning `ref`/`computed`/`shallowRef`          |
| `useState`                             | `ref` / `shallowRef` (use `shallowRef` for large parsed arrays/maps) |
| `useMemo`                              | `computed`                                                           |
| `useEffect(fn, deps)`                  | `watch` / `watchEffect` (+ `onScopeDispose` cleanup)                 |
| `useRef` (DOM / mutable box)           | template `ref` / module-local `let` in the composable                |
| `createContext` + `useContext`         | `provide` / `inject` with a typed `InjectionKey`                     |
| `forwardRef` + `useImperativeHandle`   | `defineExpose`                                                       |
| `onX` callback props                   | `defineEmits` events (`@x`)                                          |
| `.tsx` component                       | `.vue` SFC                                                           |
| Tailwind utility classes               | Tailwind 4 (pipeline adopted; class names reused 1:1 from React)     |

House rules: **no `any`** (concrete types / `unknown`+narrowing / the `XmlObject`
alias); Conventional Commits; trunk-based (commit to `main`, no feature branches
unless asked); the pre-commit husky hook runs `oxlint --deny-warnings` + `oxfmt`
(fix warnings, don't `--no-verify`); extract pure logic into testable
`composables/*.ts` with colocated `*.test.ts`.

## Directory mapping

```
packages/react/src/                      packages/vue/src/
  index.ts / utils.ts (cn)                 index.ts / utils.ts                    ✅
  theme/{types,defaults,css-vars}.ts       theme/* (re-exports shared)            ✅
  theme/context.tsx                        theme/provider.ts (provide/inject)     ✅
  viewer/PowerPointViewer.tsx              viewer/PowerPointViewer.vue            ✅
  viewer/hooks/*                           viewer/composables/*                   ✅
  viewer/components/**                     viewer/components/**                   ✅ (depth gaps above)
  viewer/utils/** (framework-agnostic)     → pptx-viewer-shared/render            ◑ (extraction ongoing)
  styles/pptx-viewer.css                   styles/pptx-vue-viewer.css (Tailwind)  ✅
```

Legend: ✅ done · ◑ partial/ongoing · ☐ not started

## Shared-code model

`packages/shared` (`pptx-viewer-shared`) holds framework-agnostic logic. It is
**bundled, not published**: each binding lists it as a devDependency and inlines
it into its own `dist` (JS + `.d.ts`); npm never sees it. `pptx-viewer-core` is
inlined the same way for React/Vue (Angular keeps core a peerDependency and
vendors shared source at build time via `scripts/inline-shared.mjs`).

Build order: `pptx-viewer-core` → `pptx-viewer-shared` → bindings.

Vue inlining: Vite omits internal packages from `rollupOptions.external` (JS) and
`vite-plugin-dts` with `bundledPackages: ['pptx-viewer-core','pptx-viewer-shared']`

- `rollupTypes: true` inlines the types. Already in `shared/render`: shape-geometry,
  fill-style, visual-effects, image-effects, text-warp, omml-to-mathml, chart-helpers
  (+ trendlines), animation-css, element-align, element-interaction, visual-3d,
  table-style, latex-to-omml. When porting/adding a pure helper, **put it in shared
  first**, then import from there in both bindings. Coordinate moves out of
  `packages/react` with the other sessions; do it as its own focused change.

> **Geometry already lives in core, don't re-extract it.** The ECMA-376 preset
> evaluator, adjustment-aware table, cloud paths, and static preset table are
> exported from `pptx-viewer-core` (`getShapeClipPathFromPreset`,
> `getAdjustmentAwareShapeClipPath`, `getCloudPathForRendering`, `getShapeClipPath`,
> `getShapeType`, `getRoundRectRadiusPx`). Import them directly.

## History (condensed)

Built incrementally **2026-06-14 → 06-18** in ~25 batches (full per-batch detail in
git log / `git show`):

1. **Foundation**: package scaffold, theme provide/inject, `useLoadContent`, base
   renderer; `pptx-viewer-shared` introduced; demo-vue (port 4175).
2. **Rendering**: every element type + effects/3D/equations/warp/fills; charts
   (incl. surface/regionMap/trendlines); connectors (all variants + labels); tables
   (GUIDs, patterns, rich text); SmartArt (10-family fallback).
3. **Editing core**: selection/drag/resize/rotate, history, operations, align/
   group/flip/z-order, snap-to-grid/shape, guides, rulers, grid, drawing tools.
4. **Inspector + dialogs**: 9 element panels + slide panel + **SmartArt editing
   panel** (`SmartArtPropertiesPanel.vue` + `SmartArtLayoutSwitcher.vue` driven by
   the `useSmartArtEditing` composable over core `addSmartArtNode*` /
   `removeSmartArtNode` / `updateSmartArtNodeText` / `reorderSmartArtNode` /
   `promote`/`demoteSmartArtNode` / `switchSmartArtLayout`; updates flow through the
   history-tracked `useEditorOperations.updateElement`, so undo/redo works), context
   menu, hyperlink/properties/share/settings/insert dialogs.
5. **Presentation/print/export**: present mode + animation playback, presenter
   view/ink/rehearse/subtitles/transitions, PNG/PDF/GIF/WebM, print, Save As.
6. **Collab & docs**: Yjs (cursors/presence/follow), comments, find/replace,
   autosave, version history/compare, accessibility, signatures, embedded fonts,
   master views, sections, custom shows, mobile chrome, keyboard shortcuts.
7. **Chrome parity**: Office-style ribbon + status bar + slides rail (Tailwind 4),
   all ribbon actions wired (Insert/View/Design/Draw/File/Slide-Show/Animations),
   spell-check; fidelity fixes (px font sizing, table text colour).
8. **Shared extraction waves**: render helpers + 3D + table-style + latex-to-omml
   hoisted to `pptx-viewer-shared`.

A scheduled cloud agent (2026-06-19) targets the remaining chart secondary/log axes
and CSS-3D extruded faces (surface/regionMap are already done; see _Remaining_).
