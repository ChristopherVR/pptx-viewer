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
  inspector/SmartArtPropertiesPanel.tsx        viewer/smart-art-properties.component.ts ✅
  inspector/SmartArtLayoutSwitcher.tsx         (folded into smart-art-properties)     ✅
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
Slide Show incl. custom shows + **Set Up Show**, Review incl. **Compare**, View
incl. grid/rulers/guides/snap/eyedropper/selection-pane + **Shortcuts**) + status
bar; the editor (select/move/resize/rotate/
marquee, inline + table-cell touch edit, clipboard, align/distribute, group,
z-order, slide CRUD, inspector incl. **SmartArt editing** (per-node text, add
item / add sub-item, remove, promote/demote, reorder up/down, colour-scheme
select, style flat/moderate/intense, and the layout switcher), undo/redo, save);
presentation mode (transitions,
presenter view, custom-show playback); the advanced subsystems (comments,
signatures, accessibility, embedded fonts, collaboration, print, export
PNG/PDF/GIF/WebM); the **secondary dialog suite** (equation editor with LaTeX ->
MathML preview + template gallery, Set Up Slide Show, password protection
set/update/remove, encrypted-file notice, deck **compare/diff** with per-slide
accept/reject, **Embed Fonts** with browser-availability scan, **Version
History** recovery panel, keyboard-shortcut cheat-sheet, keep-annotations prompt,
and the signature-stripped warning); and the **mobile chrome** (toolbar + bottom
bar + sheets, touch editing/present).

**Verification (run before claiming green):** `bun run --filter pptx-angular-viewer build`
(ng-packagr + Tailwind), `typecheck`, `test` (~2159), `bunx oxlint packages/angular/src`
(`--deny-warnings`), and `npx playwright test --project=angular` (**28 passed / 0
skipped** - the shared `e2e/*.spec.ts` run identically against React/Vue/Angular;
Angular skips none).

## What's still missing for full React parity

The remaining items are **quality/refactor debts, cosmetic polish, and two
small rendering-depth gaps, not broad behavioural gaps** - Angular is at
functional parity (28/0 e2e, the same shared specs React passes).

> **Audit + fix pass (2026-07-03):** a parity re-check found item 2 below
> (shared-logic extraction) already **closed** and stale: all nine named
> modules (`format-painter`, `omml-to-mathml`, `color-gradient`/
> `color-patterns`, `visual-effects`, `shape-geometry`, `text-bullets`,
> `ink-drawing-helpers`, `snap-guides`) are thin re-export shims into
> `pptx-viewer-shared` in all three bindings - no duplicated logic remains.
> Three real gaps found in the same audit (pressure-sensitive ink, connector
> compound lines/caps, media playback) were then fixed: **ink** now renders
> true variable-width strokes (commit `c99807f`), **connectors** render
> compound double/triple lines and line caps via new shared
> `connector-style.ts`/`connector-path.ts` helpers (commit `44176f6`), and
> **media** elements play back real `<video>`/`<audio>` via a new
> `media-renderer.component.ts` (commit `bca9960`). Item 1's file-size debt
> also got a partial pass: `ribbon.component.ts` 1978 -> 467 LOC (commit
> `6b748b6`) and `power-point-viewer.component.ts` 2356 -> 1775 LOC (commit
> `b48ce45`), both fully verified (typecheck/AOT build/test/lint green, no
> behaviour change). The `&amp;` double-encoding note that used to sit at the
> bottom of this file was fixed in core (commit 3c86556) and has been removed.

1. **File-size debt (CLAUDE.md ≤ 300 LOC rule).** Partially closed (see above).
   Remaining offenders: `power-point-viewer.component.ts` **1775** (still
   above target; six services already extracted - `viewer-export`,
   `viewer-find-replace`, `viewer-custom-shows`,
   `viewer-collaboration-session`, `viewer-format-painter`,
   `viewer-keyboard` - further reduction is a follow-up, not urgent),
   `slide-canvas.component.ts` **1524**, `custom-shows.component.ts` 572, plus
   `inspector-panel.component.ts` 964, `animation-author-panel.component.ts`
   796, `presentation-overlay.component.ts` 755, `smart-art-renderer.component.ts`
   744, `smart-art-properties.component.ts` 668, `effects-panel.component.ts`
   648, `editor-state.service.ts` 637. (Vendored `internal/shared-src` files
   mirror `packages/shared/src/render` byte-for-byte and don't count as
   Angular-specific debt.) Vue's `PowerPointViewer.vue` (2680 LOC after its own
   2026-07-03 pass, previously 3501) remains larger than any single Angular
   file - this is cross-framework debt, not an Angular-specific or
   parity-blocking gap.
2. ~~Shared-logic extraction~~ - **closed**, see audit correction above.
3. **Cosmetic pixel depth.** Control styling uses the shared Tailwind tokens but
   is not pixel-identical to every React control (spacing, icons, split-button
   affordances, dropdown chrome). A per-tab visual-diff pass would close it.

> **Recently closed** (2026-07-02): the **secondary dialog suite** that was
> previously absent (the earlier "whole surface" parity claim overstated this).
> Now implemented as standalone components wired through `ViewerExtraDialogsComponent`
> (host), `ViewerDialogsService` (open/close state) and `ViewerCompareService`:
> equation editor (`equation-editor-dialog` + extracted `equation-editor-helpers`
> / `equation-template-gallery`), `set-up-slide-show-dialog` (+ `show-options-fieldset`
> / `show-slides-fieldset`), `password-protection-dialog` (+ `password-protection-helpers`
> / `password-strength-meter`), `encrypted-file-dialog`, `compare-panel` +
> `slide-diff-row` (split into `slide-diff-thumbnails` / `slide-diff-changes` /
> `slide-diff-helpers`), `font-embedding-panel` (+ `font-embedding-helpers` /
> `font-embedding-list`), `version-history-panel` (+ `version-history-helpers`),
> `shortcut-panel` (also opened by the `?` key), `keep-annotations-dialog`, and
> `signature-stripped-dialog`. Pure logic lives in `viewer-extra-dialogs-helpers.ts`
> (equation insert, font collection, annotation -> ink, accepted-diff application),
> unit tested alongside the extracted helpers. New ribbon entry points: File-tab
> Protect / Embed Fonts / Version History, Slide Show-tab Set Up Show, Review-tab
> Compare, View-tab Shortcuts.
>
> **Recently closed** (2026-07-02): **table editing parity** on the shared
> `pptx-viewer-shared` table modules: a signal-based `table-selection.service`
> (single cell + Shift+Click rectangular ranges, shared canvas/inspector),
> `table-cell-formatting.component` (font size / colour / background / B/I/U /
> alignment / per-edge borders), `table-cell-advanced-fill.component`
> (solid / gradient / pattern + margins), cursor-anchored and range merge/split,
> merge-AWARE structural insert/delete in all four directions (`table-data-helpers`
> previously destroyed every merge on any structural change - silent data loss,
> now regression-tested), `table-properties.component` (header row, banding with
> cycles, first/last emphasis, `TABLE_STYLE_PRESETS`, numeric sizes) with banding
> and diagonal borders now actually rendered, `table-resize-overlay.component`
> drag handles, and table entries in the editor context menu.
>
> **Recently closed** (2026-07-02): **inline formatting shortcuts**: the
> slide-canvas inline `<textarea>` editor now handles Ctrl/Cmd+B/I/U, emitting a
> `textFormat` event the viewer applies via `textStylePatch` +
> `EditorStateService.updateElement` (undoable), matching React and Vue.
>
> **Recently closed** (2026-06-27): **eyedropper fallback** (`eyedropper.ts` now
> adds `sampleColorFromSlide` + a one-shot click-to-sample `pickColorByClickFallback`
> used when the native `EyeDropper` API is absent, wired into `onToggleEyedropper`)
> and **zoom target thumbnail** (`zoom-target.service.ts` feeds
> `zoom-renderer.component.ts` the target slide's background, number, and section
> name via the pure `buildZoomViewModel`, matching React's `ZoomSlideThumbnail`).
