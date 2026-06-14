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

| Item                                                     | Status | Notes                                                                                                                    |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `PowerPointViewerComponent` (load + nav + zoom)          | ◑      | loading/error/encrypted states, prev/next, zoom, thumbnail rail; `activeSlideChange` output                              |
| `SlideCanvasComponent`                                   | ◑      | scaled stage + element list; no rulers/grid/guides/overlays                                                              |
| `ElementRendererComponent`                               | ◑      | text, shape (solid fill/stroke), picture/image, media poster, group recursion (self-selector); placeholders for the rest |
| `element-style.ts`                                       | ◑      | container/shape/text/image basics; no gradient/clip-path/effects/3D                                                      |
| Rich text runs (bold/italic/underline/strike/color/size) | ◑      | per-segment spans, paragraph + line breaks                                                                               |
| Connectors (SVG)                                         | ☐      |                                                                                                                          |
| Tables                                                   | ☐      |                                                                                                                          |
| Charts (SVG)                                             | ☐      | large                                                                                                                    |
| SmartArt                                                 | ☐      | large                                                                                                                    |
| Ink / OLE / Model3D / Zoom                               | ☐      |                                                                                                                          |
| Image effects, gradients, shadows, glow, clip-paths      | ☐      |                                                                                                                          |
| Text warp / WordArt, equations (OMML→MathML)             | ☐      |                                                                                                                          |

### Editor chrome (all ☐ — not started)

Toolbar, inspector panels, context menu, dialogs, slides pane, slide sorter,
notes, mobile chrome, accessibility panel.

### Advanced subsystems (all ☐ — not started)

Presentation mode + animations/transitions, export (PNG/PDF/GIF/video — note
React uses `html2canvas-pro`, which is DOM-based and likely reusable),
collaboration (Yjs — framework-agnostic, good shared-extraction candidate),
print, find/replace, comments, digital signatures, font embedding/injection.

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
   `workspace:*` leaks): the `pptx-viewer-core` **peer** is a concrete published
   range (`^1.4.0`) rather than `workspace:*` — ng-packagr publishes from `dist/`,
   which is not a workspace member, so `workspace:*` cannot be resolved there.
   The `pptx-viewer-core` **devDependency** stays `workspace:*` to link the local
   engine for build/test.

   Remaining work before npm releases are automated:
   - Add `pptx-angular-viewer` (and its build) to the CI build/release/publish
     jobs, and bump the core peer range in lockstep with releases.

   In-repo (build, demo, typecheck, test) everything resolves via the bun
   workspace symlinks + the build-time vendoring, so nothing here blocks
   development.

5. **Imperative API.** `getContent()` is a public method. If a richer handle is
   needed (matching the React `forwardRef` surface), expand the component's
   public methods rather than introducing a service-locator.

## Recommended next steps (priority order)

1. Flesh out `ElementRendererComponent`: gradients, then clip-paths for preset
   geometries (extract `utils/geometry.ts` shape-path generation into
   `pptx-viewer-shared`), then tables, then connectors, then charts.
2. Add component/TestBed tests (decision #2).
3. Port full viewer state + editor history to unlock editing.
4. Continue the shared-code extraction (color, geometry, animation engine) —
   coordinate with the React/Vue sessions.

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
