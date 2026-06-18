# Porting `pptx-viewer` (React) → `pptx-vue-viewer` (Vue 3)

> **Living document & hand-off contract.** Keep it accurate — future sessions
> trust it instead of re-scanning the ~100k-line React package. Per-batch detail
> lives in git history; this file tracks **what's done vs. what's left for parity**.

## Goal

Ship a Vue 3 package, **`pptx-vue-viewer`** (npm), feature-equivalent to the React
`pptx-viewer` package (`packages/react`). Both wrap the framework-agnostic
`pptx-viewer-core` engine and share `pptx-viewer-shared`. An Angular port
(`pptx-angular-viewer`) follows the same conventions in a parallel session.

## Status: **component- and feature-level parity is reached**

The Vue port covers essentially the full React surface (**1275 unit tests green**,
e2e green on react/vue/angular). Done and verified live:

- **Rendering** — every element type: text (rich runs), shapes (preset clip-path
  cascade, fill/stroke), images, tables (merges, banding, `tableStyleMap` GUIDs,
  pattern fills, rich cell text), charts (bar/line/area/pie + radar/scatter/bubble/
  waterfall/funnel/sunburst/treemap/combo/stock/histogram/boxWhisker **+ surface +
  regionMap + trendlines**), SmartArt (drawing-shapes + 10-family geometry
  fallback), connectors (straight/bent/curved/compound + text overlay), ink, OLE,
  equations (OMML→MathML), WordArt/text-warp, structured fills, shape effects
  (shadow/glow/soft-edge/reflection), shape 3D (approximate), image effects.
- **Editing** — select/drag/resize/rotate, align/distribute/group/flip/z-order,
  undo-redo, snap-to-grid, **snap-to-shape**, **H/V guides**, **rulers**, grid,
  **drawing/ink tools**, inline text editing, format painter, shape-adjustment handles.
- **Chrome** — full Office-style **ribbon** (all tabs, all actions wired), **status
  bar**, **slides rail** (React-parity), **inspector** (element + slide properties),
  context menu, dialogs. Tailwind 4 pipeline adopted for visual parity.
- **Modes & I/O** — presentation mode (animation playback, presenter view, ink,
  rehearse timings, subtitles, slide transitions), export (PNG/PDF/GIF/WebM),
  print, **Save As** (pptx/ppsx/pptm), copy-slide-as-image.
- **Collab & docs** — Yjs collaboration (whole-doc + cursors + selection presence
  - follow-mode), comments, find/replace, autosave, version history/compare,
    accessibility panel, document properties (full round-trip), hyperlink/settings/
    insert-SmartArt/equation-editor dialogs, master views, header/footer, sections,
    custom shows, digital signatures, embedded fonts, mobile chrome, keyboard
    shortcuts, spell-check (native browser squiggles).

## ⏳ Remaining for parity

Everything below is **depth/fidelity**, not missing surface. Ordered roughly by
user-visible impact.

### Rendering fidelity

| Gap                                                 | Where                                                                     | Notes                                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bulleted lists** ⚠ _visible_                      | `ElementRenderer.vue` paragraph loop                                      | No bullet glyphs/indents — `bulletInfo`/`paragraphIndents` are ignored, so e.g. the sample deck's slide-2 lists render flat. Highest-impact visible gap.                                                                   |
| **Chart secondary / log / display-unit value axes** | `ChartRenderer.vue` + shared `chart-helpers.ts` + `chart/ChartChrome.vue` | Value axis is always a single linear primary axis. Needs right-hand 2nd-`axisId` series, log scale, display units, data tables, axis overlays. (Rethreads value→Y through every chart sub-component — see `// TODO(vue)`.) |
| **Real CSS-3D extruded faces**                      | shared `visual-3d.ts` + `ElementRenderer.vue`                             | Extrusion is approximated with layered box-shadows; React's `Extrusion3DOverlay` (true extruded faces) is deferred.                                                                                                        |
| **Image `clrChange` chroma-key**                    | `composables/image-effects.ts`                                            | Destructive colour-change / canvas re-encode deferred (recolour/duotone/artistic done).                                                                                                                                    |
| **Exotic equations**                                | `composables/omml-to-mathml.ts`                                           | phantom / scaling OMML constructs deferred.                                                                                                                                                                                |
| **Text-warp envelope presets**                      | `composables/text-warp.ts`                                                | `<textPath>` presets done; envelope / CSS-transform presets deferred.                                                                                                                                                      |
| **Gradient flip/tiling**                            | `composables/fill-style.ts`                                               | linear/radial gradients + patterns done; flip/tile deferred.                                                                                                                                                               |
| **Model3D real 3D / Zoom navigation**               | `Model3DRenderer`, `ZoomRenderer`                                         | three.js poster only; zoom element is a static link tile.                                                                                                                                                                  |

### Editing / chrome depth

| Gap                            | Where                           | Notes                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Master/template editing**    | `onSetEditTemplateMode` (no-op) | Needs the edit-routing pipeline that sends edits to template/master elements (React gates pointer handlers on `editTemplateMode`). The flag stays a no-op until this lands — toggling it alone would mislead. |
| **Slide-properties inspector** | `inspector/SlideInspector.vue`  | Transition type/duration/advance done. Deferred: background, slide size, theme override; transition direction/orientation/spokes/preview (core direction-constant tables aren't exported).                    |
| **`onToggleCompactToolbar`**   | ribbon                          | Trivial — currently has **no ribbon consumer**; wire a consumer or drop the prop. Not a real gap.                                                                                                             |

### Infrastructure (not user-facing parity)

- **Fine-grained CRDT collaboration** — current model is whole-doc last-write-wins
  with presence/follow on top; conflict-resolving merge is the depth item.
- **Shared-code extraction** — pure framework-agnostic helpers should keep moving
  from `packages/vue/.../composables` into `pptx-viewer-shared/render` so React/
  Angular reuse them. Outstanding candidates: the vendored **GIF encoder** (each
  binding carries a copy), plus color/connector-router/animation-engine utils not
  yet hoisted. Internal dedup, not parity-blocking. See _Shared-code model_ below.

### Known cross-framework bug (not Vue-specific)

- **`&` renders as `&amp;`** in slide text (double-encoding) on **both** React and
  Vue — a `pptx-viewer-core` text-decoding issue. Fix belongs in core.

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
**bundled, not published** — each binding lists it as a devDependency and inlines
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
  `packages/react` with the other sessions — do it as its own focused change.

> **Geometry already lives in core — don't re-extract it.** The ECMA-376 preset
> evaluator, adjustment-aware table, cloud paths, and static preset table are
> exported from `pptx-viewer-core` (`getShapeClipPathFromPreset`,
> `getAdjustmentAwareShapeClipPath`, `getCloudPathForRendering`, `getShapeClipPath`,
> `getShapeType`, `getRoundRectRadiusPx`). Import them directly.

## History (condensed)

Built incrementally **2026-06-14 → 06-18** in ~25 batches (full per-batch detail in
git log / `git show`):

1. **Foundation** — package scaffold, theme provide/inject, `useLoadContent`, base
   renderer; `pptx-viewer-shared` introduced; demo-vue (port 4175).
2. **Rendering** — every element type + effects/3D/equations/warp/fills; charts
   (incl. surface/regionMap/trendlines); connectors (all variants + labels); tables
   (GUIDs, patterns, rich text); SmartArt (10-family fallback).
3. **Editing core** — selection/drag/resize/rotate, history, operations, align/
   group/flip/z-order, snap-to-grid/shape, guides, rulers, grid, drawing tools.
4. **Inspector + dialogs** — 9 element panels + slide panel, context menu,
   hyperlink/properties/share/settings/insert dialogs.
5. **Presentation/print/export** — present mode + animation playback, presenter
   view/ink/rehearse/subtitles/transitions, PNG/PDF/GIF/WebM, print, Save As.
6. **Collab & docs** — Yjs (cursors/presence/follow), comments, find/replace,
   autosave, version history/compare, accessibility, signatures, embedded fonts,
   master views, sections, custom shows, mobile chrome, keyboard shortcuts.
7. **Chrome parity** — Office-style ribbon + status bar + slides rail (Tailwind 4),
   all ribbon actions wired (Insert/View/Design/Draw/File/Slide-Show/Animations),
   spell-check; fidelity fixes (px font sizing, table text colour).
8. **Shared extraction waves** — render helpers + 3D + table-style + latex-to-omml
   hoisted to `pptx-viewer-shared`.

A scheduled cloud agent (2026-06-19) targets the remaining chart secondary/log axes
and CSS-3D extruded faces (surface/regionMap are already done — see _Remaining_).
