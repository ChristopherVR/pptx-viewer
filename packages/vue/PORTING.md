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

> **Recently closed (2026-07-02): table editing parity pass.** Table editing now
> matches React on the shared `pptx-viewer-shared` table modules:
>
> - **Selection**: real cell selection with Shift+Click rectangular ranges
>   (`composables/table-selection.ts`, provide/inject from the viewer root),
>   replacing the previously hardwired-null `tableEditorState`; selected cells
>   highlight in `TableRenderer.vue`.
> - **Cell formatting**: `TableCellFormattingPanel.vue` (font size, colour,
>   background, B/I/U, alignment, per-edge + diagonal borders) and
>   `TableCellAdvancedFill.vue` (solid / gradient / pattern + margins); the
>   ribbon text-style path now reaches table cells.
> - **Merge / split**: cursor-anchored and range merges via the shared
>   `table-merge` / `table-cell-merge` helpers.
> - **Structural ops**: merge-aware insert/delete row/column in all four
>   directions (`composables/table-mutations.ts`), replacing the
>   last-row/column-only operations.
> - **Table style options**: `TableStyleOptions.vue` (header row, banding with
>   cycles, first/last column emphasis, `TABLE_STYLE_PRESETS`), plus numeric
>   size controls (`TableSizePanel.vue`) and a drag-resize overlay
>   (`TableResizeOverlay.vue`) on the shared resize math.
> - **Context menu**: table row/column/merge entries when a table cell is
>   selected.

> **Recently closed (2026-07-02): inline formatting shortcuts.**
> `InlineTextEditor.vue` now handles Ctrl/Cmd+B/I/U while editing text on the
> canvas, emitting a `format` toggle the viewer applies through the ribbon
> text-style path (undoable). This matches the React inline editor, whose own
> shortcuts were wired end-to-end the same day (they existed in the leaf
> component but had no provider).

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

> **Audit + fix pass (2026-07-03):** a parity re-check found this whole section
> stale. Three rows were already closed in code: **master/template editing**
> is fully wired (`isElementIdInteractive` / `isTemplateElementId` gate
> pointer hit-testing/drag/marquee; `updateElementById` routes template-id
> edits; `buildSaveSlides` merges them back into the real save path -
> `useLoadContent.ts:388`, `useCollaboration.ts:203`); the **`&` -> `&amp;`
> double-encoding bug** was fixed in core (commit 3c86556); and the
> **shared-extraction candidates** (GIF encoder, color/connector-router/
> animation-engine utils) are already hoisted into `pptx-viewer-shared`. Two
> real rendering gaps found in the same audit were then fixed: **pressure-
> sensitive ink strokes** now render true variable-width strokes (shared
> `render/ink-rendering.ts`, consumed by `InkRenderer.vue`, commit `d745a31`)
> and **connector shadow/glow** now renders via the shared `visual-effects.ts`
> helpers (commit `3f94c6d`). No rows remain in this table.

### Rendering fidelity

No known rendering-fidelity gaps remain vs React. The only differences are the
CSS-rendering approximations shared with React by design (`backdrop-filter`
and path gradients approximated on screen; some effects flatten in raster
export), documented in the root README.

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

| Gap                            | Where                          | Notes                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Slide-properties inspector** | `inspector/SlideInspector.vue` | Background (colour/image/clear), transition (type/duration/advance + direction/orientation/spokes), and per-slide theme colour override (`clrMapOverride`) are done. Deferred: slide size (display-only, does not persist to save in React either - not a Vue-specific gap) and the transition preview animation. |

Master/template editing, shared-code extraction, and the `&` -> `&amp;`
double-encoding bug were previously listed here as open; all three are
closed - see the audit-correction note above. `onToggleCompactToolbar` is
also closed: `RibbonToolbar.vue:90` wires `@click="props.onToggleCompactToolbar"`
and `PowerPointViewer.vue` supplies the handler, so it is no longer an
orphaned prop.

### Infrastructure (not user-facing parity)

- **Fine-grained CRDT collaboration**: current model is whole-doc last-write-wins
  with presence/follow on top; conflict-resolving merge is the depth item.
- **File-size debt (CLAUDE.md ≤300 LOC rule)**: `PowerPointViewer.vue` was the
  worst offender in the repo at 3501 LOC; a 2026-07-03 pass extracted six
  composables (`useElementInsertion`, `useElementDrag`, `useContextMenu`,
  `useSlideMutations`, `useAlignGroup`, `useRibbonActions`), bringing it down
  from that peak (it currently sits around 2700 LOC and continues to move as
  further extraction happens). Still above the 300-LOC target; further
  extraction is a follow-up, not urgent, and may be in progress in a parallel
  session, so treat any specific figure here as a snapshot, not a guarantee.

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
