# Porting `pptx-viewer` (React) → `pptx-angular-viewer` (Angular)

> **Living document.** Update the status tables as you port. This is the
> hand-off contract between sessions and the Angular sibling of
> [`packages/vue/PORTING.md`](../vue/PORTING.md). Keep it accurate; future
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
| Angular       | **22.x** (latest): standalone components, signals, native control flow (`@if`/`@for`)                                    |
| TypeScript    | `^6.0.3` (matches the monorepo; Angular 22 / ng-packagr 22 peer-depend on TS `>=6.0 <6.1`)                               |
| Library build | **ng-packagr** → Angular Package Format (partial-Ivy FESM + d.ts) in `dist/`                                             |
| Unit tests    | **vitest** (happy-dom) for the pure helpers; component/TestBed tests via `@analogjs/vite-plugin-angular` are a follow-up |
| Demo          | `demo-angular/`: Vite + `@analogjs/vite-plugin-angular` (mirrors the React `demo/`)                                      |

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

## Shared-code extraction: **`pptx-viewer-shared`** ✅ (in progress, landed)

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
> It is **inlined** into each binding: by tsup/vite for React/Vue, and for
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
- `animation-*.ts` (timeline / sequencer / keyframes / presets: the engine, not JSX)
- `morph-*.ts`, `warp-path-*.ts`, `latex-to-omml*.ts`, `omml-*.ts`
- `table-merge-core.ts`, `table-selection-utils.ts`
- `image-effects.ts`, `duotone-effects.ts`, `effect-dag-filters.ts`
- `clone.ts`, `compare.ts`, `generate-id.ts`, `hyperlink-security.ts`,
  `unicode-script-detection.ts`, `kinsoku-styles.ts`, `tab-leader.ts`
- `element-style.ts` logic (only the return-type/CSS-map shape differs per
  framework; a neutral core could be hoisted)

> ⚠️ Each extraction touches `packages/react` imports; do it as its own
> focused, verified change (build shared → repoint via shims → typecheck React +
> Vue + Angular). Coordinate with the React/Vue sessions.

## Directory mapping

```
packages/react/src/                          packages/angular/src/
  index.ts                                     public-api.ts                        ✅
  utils.ts (cn)                                utils.ts                             ✅
  theme/{types,defaults,css-vars}.ts           → pptx-viewer-shared                 ✅ (moved)
  theme/context.tsx (createContext)            theme/viewer-theme.ts (InjectionToken) ✅
  lib/canvas-export.ts                          -  (TODO)
  viewer/PowerPointViewer.tsx                  viewer/power-point-viewer.component.ts ◑ viewer-first
  viewer/components/SlideCanvas.tsx            viewer/slide-canvas.component.ts     ◑ basic
  viewer/components/ElementRenderer.tsx        viewer/element-renderer.component.ts ◑ basic
  viewer/hooks/useLoadContent.ts               viewer/load-content.service.ts       ◑ viewer-first
  viewer/hooks/load-content-helpers.ts         → pptx-viewer-shared                 ✅ (moved)
  viewer/utils/* (style subset)                viewer/element-style.ts              ◑ tiny subset
  viewer/constants/scalar.ts                   → pptx-viewer-shared + constants.ts  ✅ (subset)
  viewer/types-ui.ts                           viewer/types.ts (+ shared)           ◑ public subset
  viewer/components/{toolbar,inspector,...}    viewer/ribbon.component.ts (+ panels)  ✅
  styles/pptx-viewer.css (Tailwind)            styles/pptx-angular-viewer.css       ✅ Tailwind 4
```

Legend: ✅ done · ◑ partial/basic · ☐ not started

## Demo

`demo-angular/`: Vite + `@analogjs/vite-plugin-angular`. Pick a `.pptx` file and
render it with `<pptx-viewer>`:

```bash
bun run --filter pptx-angular-demo dev      # http://localhost:4174
bun run --filter pptx-angular-demo build    # production build
```

The demo aliases `pptx-angular-viewer` to its built `dist/` (Angular Package
Format), so **build the library first** (`bun run --filter pptx-angular-viewer build`).

## Status

The Angular viewer + editor is at **functional parity with React** across the
whole surface: all 11 element types render (fills/effects/clip-paths/backgrounds,
lists, hyperlinks, equations, charts incl. bubble/radar/combo/stock/surface/
treemap/waterfall, connectors with A\* routing); the full **Tailwind 4 Office
ribbon** (File/Home/Insert incl. Table/SmartArt/Equation, Text, Draw incl.
freehand ink, Arrange, Design incl. theme gallery, Transitions, Animations,
Slide Show incl. custom shows, Review, View incl. grid/rulers/guides/snap/
eyedropper/selection-pane) + status bar; the editor (select/move/resize/rotate/
marquee, inline + table-cell touch edit, clipboard, align/distribute, group,
z-order, slide CRUD, inspector, undo/redo, save); presentation mode (transitions,
presenter view, custom-show playback); the advanced subsystems (comments,
signatures, accessibility, embedded fonts, collaboration, print, export
PNG/PDF/GIF/WebM); and the **mobile chrome** (toolbar + bottom bar + sheets,
touch editing/present).

**Verification (run before claiming green):** `bun run --filter pptx-angular-viewer build`
(ng-packagr + Tailwind), `typecheck`, `test` (~2159), `bunx oxlint packages/angular/src`
(`--deny-warnings`), and `npx playwright test --project=angular` (**28 passed / 0
skipped** - the shared `e2e/*.spec.ts` run identically against React/Vue/Angular;
Angular skips none).

## What's still missing for full React parity

The remaining items are **quality/refactor debts and cosmetic polish, not
behavioural gaps** - Angular is at functional parity (28/0 e2e, the same shared
specs React passes).

1. **File-size debt (CLAUDE.md ≤ 300 LOC rule).** Several Angular files exceed the
   limit and should be split: `ribbon.component.ts` (~1.2k LOC, extract each
   tab's `@case` into its own section component + split tab-bar / primary-row /
   status-bar), `power-point-viewer.component.ts`, `slide-canvas.component.ts`,
   `custom-shows.component.ts`. Large mechanical refactor (AOT-template risk),
   do as a dedicated, verified pass.
2. **Shared-logic extraction (CLAUDE.md "share-first" rule).** Pure helpers ported
   locally into `packages/angular` duplicate React/Vue: `format-painter.ts`,
   `omml-to-mathml.ts`, `color-gradient`/`color-patterns`, `visual-effects`,
   `shape-geometry`, `text-bullets`, `ink-drawing-helpers`, `snap-guides`, etc.
   Hoist into `pptx-viewer-shared` (`render/…`); one copy per binding. Touches
   React + Vue imports too; do as its own focused change (see candidates above).
3. **Cosmetic pixel depth.** Control styling uses the shared Tailwind tokens but
   is not pixel-identical to every React control (spacing, icons, split-button
   affordances, dropdown chrome). A per-tab visual-diff pass would close it.
4. **Eyedropper fallback (minor).** Angular uses the native `EyeDropper` API only;
   React adds a best-effort rasterize-and-sample fallback for Firefox/Safari
   (itself a stub). Low value; port if exact parity is wanted.

> Parity-neutral (NOT Angular-specific, so out of scope here): the `&amp;` HTML
> entity renders un-decoded in list text in **React, Vue, and Angular alike** - a
> core/converter double-encoding fix that affects all three equally.
