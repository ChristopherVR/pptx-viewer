# AGENTS.md

Guidance for coding agents (Claude Code, Codex, and others) working in this
repository. This file is canonical: `CLAUDE.md` only imports it, so edit this
file and never fork the two again (they drifted once already).

## READ FIRST: the two rules that govern every UI change

This repo ships **five** UI bindings (react, vue, angular, svelte, vanilla) over
one framework-agnostic engine. Almost every expensive bug in its history came
from breaking one of these two rules. They are not aspirational; they are the
definition of "done" for any work that touches a binding.

### Rule 1: a fix or feature in one binding must reach all five

**Never finish a UI change in a single binding.** If you fix a bug in React, the
same bug is almost certainly present in vue, angular, svelte and vanilla, because
the bindings are ports of each other. Fixing one and stopping is how divergence
gets created, and divergence is the most expensive debt in this repo.

The required loop for **every** UI bug fix:

1. **Diagnose the root cause**, not the symptom. Ask "where does this behaviour
   actually come from?" If the answer is a shared module, one edit fixes all
   five. If the answer is per-binding code, the bug exists five times. If the
   answer is the parsed model itself, the fix belongs in `../ooxml-core` (see
   [Where things live](#where-things-live)).
2. **Grep the other four bindings for the same pattern** before declaring the
   fix scoped. Search for the property, class name, helper, or condition you just
   changed across `packages/{react,vue,angular,svelte,vanilla}`.
3. **Fix every affected binding in the same change.** Do not defer four of them
   to "a follow-up"; the follow-up never happens and the drift becomes permanent.
4. **Add a regression test per binding**, plus a framework-neutral spec in `e2e/`
   when the behaviour is observable in a demo.
5. **Verify in the running demos**, not just the unit suites. All five suites
   have been green while a binding was visibly broken, because the defect lived
   in template wiring no unit test covered. See the demo-resolution table below
   (angular needs a build first).
6. **If one binding is genuinely blocked, say so explicitly** and file a tracking
   issue. Silently fixing one binding is the failure mode.

Assume a UI bug is structural until proven otherwise. "Genuinely
framework-specific" means Angular change detection, Svelte 5 runes, React effect
ordering, and the like. A wrong colour, a mis-clipped shape, an off-by-one drag
handle, or a dialog that will not open is almost never framework-specific.

### Rule 2: take every opportunity to extract logic into `pptx-viewer-shared`

When you touch logic in a binding, **ask whether it belongs in
`packages/shared/src/render/` instead**, and move it there if it does. This is
not a cleanup task to schedule later; it is how the parity rule above is made
cheap. Logic that lives in shared is fixed once for all five bindings, and never
drifts.

Extraction triggers, any one of which means stop and extract:

- You are about to make the same edit in more than one binding.
- You are porting a fix from one binding to the others.
- You find a pure helper (no framework imports) sitting inside
  `packages/{react,vue,angular,svelte,vanilla}`.
- You are writing new logic for a feature that all five bindings will need.

The target shape is a **pure decision function**: shared exports a function that
returns a framework-neutral descriptor, and the binding does nothing but map that
descriptor onto its own style object or template. Following that shape, a new
branch reaches all five bindings at once.

Both rules are expanded, with the concrete failures that motivated them, under
[Key Conventions](#key-conventions).

## Where things live

This repository is **UI only**. The logic is split across sibling repositories,
all expected to be checked out next to this one (`D:\Development\<name>` on the
maintainer's machine, so `../<name>` from here):

| Repository (sibling path) | npm package                         | Owns                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pptx-viewer` (this one)  | `pptx-*-viewer`, `pptx-viewer-core` | The five bindings, the internal `shared` view logic, locales, MCP tools, installer, demos, e2e, docs site. `packages/core` is only a thin public entry point.                                                                                                                                                                                                                                      |
| `../ooxml-core`           | `ooxml-core`                        | **All OOXML logic.** The PowerPoint engine (parse, edit, serialize, theme resolution, geometry, charts, SmartArt, animation model, converter, CLI, signatures) lives in its `src/pptx/` area. Shared areas: `units`, `color`, `geometry`, `xml`, `opc`, `diagram`, `docx`. Its own `AGENTS.md` has the rules (pptx area uses relaxed TS flags, provenance, release flow).                          |
| `../ole2`                 | `@christophervr/ole2`               | **Legacy binary formats.** MS-CFB / OLE2 compound files (`ole2-parser-*`, `ole2-stream-edit`), Word 97-2003 `.doc` (`ole-document-doc-*`), Excel BIFF8 (`legacy-excel-*`), legacy PowerPoint `.ppt` record stream, RC4 CryptoAPI and the `.ppt` writer (`src/ppt/`, `src/ppt/writer/`), Publisher/Visio inspection, summary properties, plus shared digests, RC4 and a PNG encoder (`src/utils/`). |
| `../emf-converter`        | `emf-converter`                     | EMF/WMF metafile rendering to PNG/SVG.                                                                                                                                                                                                                                                                                                                                                             |
| `../mtx-decompressor`     | `mtx-decompressor`                  | MicroType Express (embedded EOT font) decompression.                                                                                                                                                                                                                                                                                                                                               |
| `../docx-viewer`          | `docx-*`                            | The sibling Word viewer, built the same way (UI only over `ooxml-core/docx`). Not a dependency here.                                                                                                                                                                                                                                                                                               |

How they connect:

- `packages/core` (`pptx-viewer-core`) depends on the **published**
  `ooxml-core` (`^0.1.0`) and re-exports
  `ooxml-core/pptx` (plus `/pptx/converter`, `/pptx/cli`,
  `/pptx/signature-node`). Its `src/` holds four entry files and an
  entry-point contract test, nothing else.
- `ooxml-core` depends on `emf-converter`, `mtx-decompressor`, `jszip` and
  `fast-xml-parser`, and takes `@christophervr/ole2` as a **pinned development
  dependency** whose codecs are **inlined** into the `pptx` bundle. Consumers of
  this repo therefore never install ole2; `scripts/check-core-package.mjs`
  fails the build if a published file leaks an `@christophervr/ole2` import.
- Inside `ooxml-core/src/pptx/core/utils/ole2-parser-*.ts`,
  `.../utils/ole-document-doc-*.ts` and most of `.../ppt/writer/*.ts` are
  **one-line compatibility re-exports** of ole2. The implementation is in
  `../ole2/src`. Model conversion (`ppt-to-pptx.ts`, `element-to-write-model.ts`,
  `degrade-element.ts`, `master-roundtrip-*`) and modern OOXML packaging stay in
  ooxml-core.
- Modern DOCX never goes into ole2; binary codecs never go into ooxml-core;
  engine logic never goes into this repo.

### Where does my change go?

| The change is about...                                                                                                | Make it in                                                     |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Parsed model is wrong: a value missing/misread from the XML, theme/placeholder inheritance, save/round-trip loss      | `../ooxml-core/src/pptx/` (with a round-trip test there)       |
| Unit, colour, geometry or preset-shape maths reused across Office formats                                             | `../ooxml-core/src/{units,color,geometry}/`                    |
| `.ppt` / `.doc` / `.xls` binary reading or writing, CFB containers, RC4 encryption                                    | `../ole2/src/` (with a fixture-based test there)               |
| EMF/WMF pictures or embedded EOT fonts render wrong                                                                   | `../emf-converter` / `../mtx-decompressor`                     |
| How a correctly parsed element is drawn, laid out, hit-tested, animated or exported; any UI decision 2+ bindings need | `packages/shared/src/render/` (this repo)                      |
| Template/JSX wiring, framework reactivity, binding-only chrome                                                        | `packages/{react,vue,angular,svelte,vanilla}/src/` (all five)  |
| UI strings                                                                                                            | `packages/shared/src/i18n/` + `packages/locales/src/<locale>/` |
| AI/MCP tool functions and schemas                                                                                     | `packages/tools/src/`                                          |

Never copy an implementation from ooxml-core or ole2 back into this repo (or
between ooxml-core and ole2) to "fix it locally". To land an engine fix, change
the sibling repo, release it through its own pipeline, then bump the range in
`packages/core/package.json`.

### Working against a local ooxml-core

To try engine changes before they are published: build `../ooxml-core`
(`bun install && bun run build`; it needs `../ole2` only through its pinned npm
version), switch `packages/core/package.json` to
`"ooxml-core": "file:../../../ooxml-core"`, and run
`bun install --force` here (again after every ooxml-core rebuild). **Restore the
`^x.y.z` range before committing**; `scripts/publish-manifest.mjs` refuses a
`file:` runtime dependency. `packages/core` keeps `jszip`, `fast-xml-parser` and
`emf-converter` as devDependencies only so the e2e helpers (which resolve them
from core's scope) and Vite's dev pre-bundle of the Angular demo still find them.

### Map of this repository

```
packages/
  core/             pptx-viewer-core     - Thin entry point re-exporting ooxml-core/pptx
  shared/           pptx-viewer-shared   - Framework-agnostic viewer logic (INTERNAL, bundled into each binding, never published)
    src/render/       decision functions + descriptors every binding maps onto its view layer
    src/i18n/         canonical English dictionary (translations-en.ts)
    src/ai/           AI panel; ai/tools/mcp-registry.ts imports pptx-viewer-mcp
    src/export/ loader/ theme/ three-view/ smartart-3d/ web-components/
  locales/          pptx-viewer-locales  - de/es/fr/zh-CN dictionaries (internal)
  react/            pptx-react-viewer    - React viewer/editor component
  react-compat/     (private, no build)  - React 18 peer set; `packages/react` aliases onto it to
                                           re-run its suite + declaration check (`bun run test:react18`)
  vue/              pptx-vue-viewer      - Vue 3 viewer/editor component
  angular/          pptx-angular-viewer  - Angular viewer/editor component (ng-packagr; vendors shared into src/internal/shared-src)
  vanilla/          pptx-vanilla-viewer  - Zero-framework (VanillaJS) viewer
  svelte/           pptx-svelte-viewer   - Svelte 5 viewer component
  tools/            pptx-viewer-mcp      - MCP server / tooling (codec, schemas, tools)
  cli/              @christophervr/pptx-viewer - Installer and React compatibility re-export
demos/demo-{react,vue,angular,vanilla,svelte}/   Vite demo apps (ports 4173/4175/4174/4176/4177)
e2e/                Playwright specs (framework-neutral; `bun run e2e:contract` enforces it),
                    e2e/support (cross-binding parity harness), e2e/fixtures (decks, also the demos' public dir)
scripts/            build/release/check scripts, fixture generators (make-*.mjs/.ps1),
                    COM acceptance against real PowerPoint (com-acceptance*.mjs, Windows + bun only,
                    import ../ooxml-core/src/pptx directly)
docs/               VitePress documentation site (installs separately)
```

`ooxml-core` keeps a committed snapshot of `e2e/fixtures` under
`src/pptx/__tests__/fixtures/e2e` for its own tests. The generator scripts stay
here; refresh that snapshot deliberately, never automatically.

## Build & Development Commands

```bash
bun install                  # Install all workspace dependencies
bun run build                # Build core, shared, locales, tools, five bindings, installer, and React demo
bun run test                 # Run vitest across all packages (scripts/test-all.sh)
bun run typecheck            # Type-check all packages
bun run fmt                  # Format all files with oxfmt
bun run fmt:check            # Check formatting (CI-safe, no writes)
bun run lint                 # Lint with oxlint
bun run lint:fix             # Auto-fix lint issues
bun run e2e                  # Neutrality contract + Playwright
bun run demo                 # Start the React demo dev server (Vite, port 4173)
bun run demo:vue             # Start the Vue demo dev server (Vite, port 4175)
bun run demo:angular         # Start the Angular demo dev server (Vite, port 4174)
bun run demo:vanilla         # Start the VanillaJS demo dev server (Vite, port 4176)
bun run demo:svelte          # Start the Svelte demo dev server (Vite, port 4177)
bun run changelog:unreleased # Preview changelog notes for commits since the last release run
bun run release:plan         # Dry-run the release planner (per-package versions + bump levels)

# Per-package (run from package directory)
bun run build                # Run the package-specific build pipeline
bun run dev                  # Watch mode
bun run test                 # Run vitest
bun run typecheck            # Type-check
```

The root build runs **core -> shared -> locales -> tools -> react -> vue ->
angular -> vanilla -> svelte -> cli -> React demo**. The engine's own test
suite runs in `../ooxml-core`; `packages/core` here only runs entry-point
contract tests.

### `@local-only` e2e tests and the pre-push hook

A few e2e specs do real-time video capture and reliably crash the hosted CI
runner rather than just failing (see `e2e/export-raster-tiling.spec.ts`), so
they carry the Playwright tag `@local-only` and are excluded from CI via
`grepInvert` in `playwright.config.ts`. Run them with `bun run
e2e:local-only`. A `.husky/pre-push` hook (`scripts/pre-push-local-e2e.mjs`
decides whether to run it, based on which paths a push touches) runs them
automatically before a push that touches export-video code; skip a specific
push with `PPTX_SKIP_PREPUSH=1` or `git push --no-verify`. See
CONTRIBUTING.md for the full explanation.

## How the Demos Resolve Packages (read before debugging one)

The five demo apps are the runtime surface for binding work. Each demo's
`vite.config.ts` aliases bare package specifiers, but **not uniformly**, and the
difference decides whether your edit is live on reload or needs a build first.

| Specifier                     | react      | vue        | angular      | vanilla    | svelte     |
| ----------------------------- | ---------- | ---------- | ------------ | ---------- | ---------- |
| the binding (`pptx-*-viewer`) | source     | source     | **`dist`**   | source     | source     |
| `pptx-viewer-core`            | source     | source     | **`dist`**   | source     | source     |
| `pptx-viewer-shared`          | **`dist`** | source     | **vendored** | source     | source     |
| `pptx-viewer-locales`         | source     | source     | **`dist`**   | source     | source     |
| `pptx-viewer-mcp`             | **`dist`** | **`dist`** | **`dist`**   | **`dist`** | **`dist`** |

`pptx-viewer-core` "source" is only the thin entry file: the engine behind it
always comes from the installed `ooxml-core` `dist` in
`node_modules`, so an engine edit in `../ooxml-core` is invisible to every demo
until you rebuild it and reinstall (see
[Working against a local ooxml-core](#working-against-a-local-ooxml-core)).

Anything marked `dist` resolves through the workspace `exports` field to built
output, so **source edits are invisible until you build that package**:

- **Angular**: `pptx-angular-viewer` is built by ng-packagr, so the demo reads
  `packages/angular/dist`. Editing `packages/angular/src` changes nothing on
  screen until `bun run build` in `packages/angular`. This is the single most
  common way to waste an hour concluding "my change doesn't work in Angular".
  Angular also vendors shared source into `src/internal/shared-src` at build
  time, so shared edits need the same rebuild. **Its `pptx-viewer-core` is
  `dist` too**: the demo never aliases core, unlike the other four, so a core
  change needs `bun run --filter pptx-viewer-core build` before this demo sees
  it at all. Core is also in the demo's `optimizeDeps.include`, so vite
  pre-bundles it into `demos/demo-angular/node_modules/.vite/deps/pptx-viewer-core.js`;
  that copy normally re-optimises when core's dist changes, but it has been
  observed serving a stale core anyway (a long-running server on Windows, where
  the watcher does not always see writes through the workspace symlink). If
  Angular alone disagrees with the other four demos, delete that demo's
  `node_modules/.vite` and restart before suspecting your code.
  `e2e/dist-freshness.ts` checks both axes before every e2e run.
- **`pptx-viewer-mcp`** (`packages/tools`) is aliased by no demo. It is reachable
  from the browser because `packages/shared/src/ai/tools/mcp-registry.ts` imports
  it, so a **stale `packages/tools/dist` breaks all five demos at once** with
  `Module "path" has been externalized for browser compatibility`. The giveaway
  is a demo that renders only its version footer. Fix with `bun run build` in
  `packages/tools`.
- **`pptx-viewer-shared`**: after adding a NEW export, run `bun run build` in
  `packages/shared` once, or the React and Angular demos will not see it.

Other demo gotchas:

- **Zombie vite servers** keep serving stale code after a refactor. Check with
  `netstat -ano | grep -E ":(4173|4174|4175|4176|4177) .*LISTENING"`, and if
  behaviour contradicts the source, kill the PID and relaunch rather than
  debugging the code.
- **Stale vite dep caches** cause bogus framework-internal crashes. A stale
  `demos/demo-svelte/node_modules/.vite` threw a "Cannot read properties of
  undefined" error from inside Svelte's own runtime and stopped decks rendering
  entirely. Delete the demo's `node_modules/.vite` and restart before believing
  a stack trace that points into a framework.
- **A demo that never renders is usually a cached resolution failure, not your
  code.** Vite caches a FAILED import resolution, so a module added while the
  server was running keeps 500-ing after the file exists on disk and is
  committed. The tell is that every e2e test times out on `#file-input` at once
  while the page itself returns HTTP 200: the shell serves, the app never
  mounts. Diagnose by checking which port actually 500s rather than assuming the
  suite found a real regression:
  `curl -s http://localhost:4176/@fs/<abs-path>/packages/shared/src/render/index.ts`
  names the unresolved import. Then kill that port, delete that demo's
  `node_modules/.vite`, and restart it. This has masked "all parity specs
  failed" more than once; four of five demos being healthy is the clue.
- **Rebuilding `packages/angular/dist` breaks the running Angular demo.** It
  starts 404-ing on its own CSS and its vite pre-bundle of core goes stale
  (`e2e/dist-freshness.ts` checks that second axis separately and tells you to
  clear it). After any `bun run --filter pptx-angular-viewer build`, kill :4174,
  `rm -rf demos/demo-angular/node_modules/.vite`, and restart before running
  e2e.
- The demos serve `e2e/fixtures` as their public dir, and the landing page's
  "or create a New Presentation" button gives an editable deck without a file.

## Architecture

### Engine (`../ooxml-core/src/pptx/`, exposed by `packages/core`)

Paths in this section are relative to `../ooxml-core/src/pptx/`. Do not add
engine logic to this repository. The area is compiled with relaxed TypeScript
flags for now (`tsconfig.pptx.json`), and its geometry, colour and unit
primitives come from the `geometry`, `color` and `units` areas of ooxml-core.

- **`PptxHandler`** (`core/PptxHandler.ts`) is the public facade. It wraps
  `PptxHandlerCore` -> `PptxHandlerRuntime` (`core/core/`).
- **Runtime uses mixin composition**: focused modules in `core/core/runtime/`
  (`PptxHandlerRuntime*.ts`) each add one capability (parsing, saving, theme
  resolution, etc.) to `PptxHandlerRuntime`.
- **Type system** in `core/types/`: interfaces and type guards. `PptxElement` is
  a discriminated union of 16 element types (`text`, `shape`, `connector`,
  `image`, `picture`, `table`, `chart`, `smartArt`, `ole`, `media`, `group`,
  `ink`, `contentPart`, `zoom`, `model3d`, `unknown`). Narrow with
  `element.type`.
- **Load pipeline**: ArrayBuffer -> JSZip -> parse XML (fast-xml-parser) ->
  resolve themes/masters/layouts -> `PptxData`. Legacy `.ppt` input goes through
  `core/ppt/` (`ppt-to-pptx.ts`), whose binary reading comes from ole2.
- **Save pipeline**: `PptxSlide[]` -> serialize elements to OpenXML -> rebuild
  rels/content types -> JSZip -> `Uint8Array`. Saving as `.ppt` uses
  `core/ppt/writer/` (model conversion here, record writers in ole2).
- **Theme resolution chain**: Element -> Placeholder -> Layout -> Master -> Theme.
- **Geometry engine** in `core/geometry/`: 187 OOXML preset shapes, clip paths,
  connector routing, guide formula evaluation.
- **Converter** in `converter/`: PPTX -> Markdown with registry-pattern dispatch
  per element type. **CLI** in `cli/`, **signature verification** (Node only)
  in `signature-node/`.
- **Tests and fixtures** in `__tests__/` (integration corpus, round-trip,
  `fixtures/e2e` snapshot).

### Viewer layer (this repo)

- **`pptx-viewer-shared`** decides; bindings render. Shared exports pure
  decision functions and descriptors (`packages/shared/src/render/`), the
  ribbon/dialog view models, i18n, export, the AI panel, and the three.js
  views.
- **React** (`packages/react/src/`): `PowerPointViewer` is the forwardRef
  orchestrator. Custom hooks coordinate state (`useViewerState`,
  `useEditorHistory`, `useEditorOperations`, `useLoadContent`,
  `useExportHandlers`, `usePresentationMode`); components render and wire
  interactions. The other four bindings mirror this structure in their own
  idiom.
- **CSS-based rendering** (not Canvas): slides render as scaled HTML/SVG with
  CSS transforms. Charts render as inline SVG, tables as HTML `<table>`,
  connectors and shapes use SVG `clip-path`.
- **Export** uses html2canvas-pro for rasterization (PNG/PDF/GIF/video).

## Key Conventions

- **Mixin pattern** (engine): runtime modules are `PptxHandlerRuntime*.ts`
  files in ooxml-core. Each handles one concern. New capabilities are added as
  new mixins.
- **Barrel exports**: every directory has `index.ts`. Import from barrels, not
  individual files.
- **Type narrowing**: always use the `type` discriminant for `PptxElement`, e.g.
  `if (element.type === "image")`.
- **EMU units**: PowerPoint uses English Metric Units internally. Conversion
  constants are in ooxml-core `src/pptx/core/constants.ts` (`EMU_PER_INCH =
914400`, `EMU_PER_POINT = 12700`, `EMU_PER_PIXEL = 9525`).
- **Service interfaces**: services define `I*` interfaces for DI/testability.
- **File naming**: kebab-case for utilities, PascalCase for classes. Tests
  colocated with source (`.test.ts` suffix).
- **No `any`.** Use concrete types, `unknown` plus narrowing, or the `XmlObject`
  type (ooxml-core `core/types/common.ts`) for parsed XML.
- **File size: keep every source file <= 300 LOC.** No `.vue` / `.ts` / `.tsx`
  source file should exceed ~300 lines (tests excluded). When a file approaches
  the limit, **split it out** rather than letting it grow: extract pure logic into
  a focused module, lift sub-views into their own components, and group related
  helpers into their own files. A component SFC that declares its own `interface`s
  or non-trivial computation is a smell; that logic belongs in a composable or a
  shared module, leaving the SFC as thin presentation. Prefer many small,
  single-purpose files over one large one.
- **Share framework-agnostic logic; default to `pptx-viewer-shared`.**
  (Rule 2 above; the extraction triggers are listed there.) The vast
  majority of each binding's code is _not_ framework-specific: geometry,
  style/colour/gradient resolution, text/paragraph/bullet building, chart/axis
  maths, connector routing, animation, OMML/LaTeX, export data, etc. All of that
  belongs in **`pptx-viewer-shared`** (`packages/shared/src/render/...`),
  consumed by every binding, or further down in ooxml-core when it is about the
  document model rather than its presentation. Only the actual view layer (SFC
  templates / JSX / Angular templates + the thin reactive wiring) should live in
  a binding. When porting or adding a feature, put the logic in shared **first**,
  then have each binding import it; do not reimplement it per framework.
  - **The shape to aim for is a pure decision function.** Shared exports a
    function returning a framework-neutral _descriptor_; the binding only maps
    that descriptor onto its own style object / template. Existing examples:
    `presentation-keymap` (`mapPresentationKey`), `connector-hit-target`,
    `hollow-shape-hit-test`, `shape-geometry-cascade`. Following that shape, a
    new branch reaches all five bindings at once.
  - **"I am making the same edit in N bindings" is the extraction signal.** Not
    a nuisance to push through: stop and extract. Small tails are the dangerous
    ones, because each copy looks trivial in isolation and nobody diffs five
    files that all look fine. The shape-geometry cascade was hand-ported five
    times, and Angular silently drifted: it compared `shapeType` **raw**
    (`=== 'ellipse'`) instead of via `getShapeType`, so `oval` - a preset in the
    shape picker - and every capitalised spelling missed the branch, and it had
    no connector/line/cylinder branch at all.
  - **Normalise before you branch.** Compare against `getShapeType(...)`, never
    a raw `shapeType` string: the normaliser folds aliases (`oval`->`ellipse`,
    `can`->`cylinder`) and lowercases. A raw compare is the single most common
    way a binding drifts.
  - **A shared value can be clobbered downstream.** Setting a property in a
    shared style map does not mean it survives: a binding may spread that map
    and then override the very property (Svelte's `ElementRenderer` re-sets
    `pointerEvents` from its own interactive flag). After adding a
    behaviour-bearing style in shared, grep each binding for that property.
  - **Per-binding unit tests passing does NOT mean the binding works.** All five
    suites were green while Svelte was still visibly broken, because the defect
    lived in template wiring no unit test covered. Load the deck in each demo
    and verify the actual behaviour (see the demo-resolution table above; Angular
    needs a build first).
- **UI changes must reach all five bindings.** (Rule 1 above; the required
  bug-fix loop is listed there.) This is a merge requirement, not
  a nice-to-have: a user on Svelte is entitled to the feature set a user on
  React gets, and divergence between bindings is the most expensive debt in this
  repo.
  - **A new UI feature** (ribbon control, dialog, inspector panel, context-menu
    entry, keyboard shortcut, gesture, on-canvas affordance) is not done when it
    works in React. Put the logic in `pptx-viewer-shared`, then implement the
    view layer in **react, vue, angular, svelte, and vanilla**, with unit tests
    per binding and a framework-neutral spec in `e2e/`.
  - **A UI fix** must be checked against the other four bindings before it is
    called finished. Most UI bugs here are structural (they came from a shared
    module, or four bindings made the same porting mistake), so the same defect
    usually exists elsewhere. Fix every affected binding in the same change and
    add a regression test to each. If one is genuinely blocked, say so
    explicitly and file a tracking issue: silently fixing one binding is what
    causes the drift.
  - **Prefer fixing a UI bug in shared over fixing it five times.** When the
    buggy behaviour is decided by logic that could live in
    `packages/shared/src/render/`, move it there as part of the fix so the
    correction lands once and cannot drift again. A bug you are about to patch
    in more than one binding is the strongest possible extraction signal.
  - "Genuinely framework-specific" means Angular change detection, Svelte 5
    runes, React effect ordering, and the like. A wrong colour, a mis-clipped
    shape, an off-by-one drag handle, or a dialog that does not open is almost
    never framework-specific.
  - See `CONTRIBUTING.md` (the parity rule + decision table) for the version
    external contributors are held to.
- **No em-dashes; use ASCII punctuation.** Never write the em-dash character
  (U+2014) anywhere: source, comments, JSDoc, docs/READMEs, commit
  messages, or UI copy. Use a colon, comma, semicolon, parentheses, or a
  spaced hyphen instead, whichever reads naturally. The only
  exception is functional UI/test content that intentionally renders or
  asserts that character (for example, a no-value marker or a placeholder
  option label). The pre-commit tooling does not catch em-dashes, so keeping
  them out is on you.
- **The pre-commit lint hook skips `.vue` files.** Its glob covers only the
  js/ts extensions, so an oxlint warning inside a `.vue` SFC sails through the
  hook and fails `bun run lint` later. Lint Vue changes explicitly before
  committing.
- **Adding an English i18n key requires every locale too.** New entries in
  `packages/shared/src/i18n/translations-en.ts` need matching entries under
  `packages/locales/src/<locale>/`; `packages/locales/src/locales.test.ts`
  enforces that every locale covers every canonical key.

## Branching & Git Workflow

This repo uses **trunk-based development**: commit directly to `main`. **Do not
create feature branches unless the user explicitly asks for one.** This overrides
any default "branch before committing" assumption. Changes to `../ooxml-core`
and `../ole2` are committed in those repositories and follow their own
`AGENTS.md`.

> The working tree is sometimes **shared by parallel agent sessions** (e.g.
> the concurrent React / Vue / Angular ports). Another session may switch the
> checkout to its own branch underneath you. Before committing, run
> `git branch --show-current` and `git status` to confirm what you're on. To do
> `main`-branch work without yanking the shared checkout out from under another
> session, push `HEAD:main` (or use an isolated `git worktree`) rather than
> `git checkout main`.

## Commit Conventions

Commits **must** follow [Conventional Commits](https://www.conventionalcommits.org).
Each published package is versioned and released **independently**: the release
pipeline (`scripts/release-plan.mjs`, run on a schedule / manual dispatch by
`release.yml`, batching everything merged since the previous run) bumps a
package only when files under its directory (or a bundled dependency) change
since its own last `<npm-name>@<version>` tag. **The bump level comes from the
commit types**: a breaking change (`!` or `BREAKING CHANGE:` footer) bumps
major, `feat` bumps minor, everything else bumps patch. It then PREPENDS the
new section to that package's `packages/<pkg>/CHANGELOG.md` with
[git-cliff](https://git-cliff.org) (config: `cliff.toml`) scoped to the same
paths, commits the version bumps + changelogs back to main, and cuts a
`<npm-name>@<version>` tag + GitHub release that publishes just that package.
Old tags/releases are culled weekly (`prune-releases.yml`), which is safe only
because changelogs are prepend-only; never regenerate a CHANGELOG.md from tag
history. Non-conforming commits are silently dropped from the changelog, and a
mislabelled type now also mis-bumps the version, so the format is load-bearing,
not cosmetic. Which package(s) a commit lands in is determined by the **paths**
it touches, so keep a commit's changes within one package where practical.

Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`,
  `build`, `ci`, `style`, `chore`, `revert`. These map to changelog sections
  (see `cliff.toml` -> `commit_parsers`). `feat`/`fix`/`perf`/`refactor` are
  user-facing; `chore(deps)` groups dependency bumps.
- **scope**: optional, the affected package/area: `core`, `react`, `vue`,
  `shared`, `tools`, `ci`, `deps`, etc. Use it; the changelog bolds it.
- **subject**: imperative mood, lower-case, no trailing period. Keep the first
  line <= ~72 chars.
- **breaking changes**: append `!` after the type/scope (`feat(core)!: ...`) or
  add a `BREAKING CHANGE:` footer.

Examples (from history): `feat(core): typed xml-access helpers`,
`fix(react): remove dead table-cell comparisons`, `chore(deps): update all
dependencies to latest`.

**Authoring tip (tooling):** when committing via a multi-line message, use a
real heredoc or `git commit -F <file>`; do **not** wrap the message in
`@'...'@` (PowerShell here-string syntax); under `bash`/`sh` the stray `@`
characters leak into the subject and break Conventional Commit parsing. End
commit messages with the required `Co-Authored-By:` trailer.

**Never include an AI chat share link.** Do not add a `claude.ai/chat/...` (or
any other assistant conversation) URL to a commit message, PR body, issue
comment, changelog entry, code comment or doc. Those links are session-scoped
and mean nothing to a reader of this repository. The `Co-Authored-By:` trailer
is the only attribution that belongs in a commit.

## Tech Stack

- **TypeScript** (strict; versions differ per package, see each `package.json`),
  **Bun** (package manager/runtime), **tsup/tsdown**, **Vite/Rollup**, and
  **ng-packagr** (package-specific build pipelines)
- **React 19** (React 18 supported via `react-compat`), **Framer Motion**,
  **Tailwind CSS 4**, **Lucide React**
- **Vitest** (testing), **Playwright** (e2e), **JSZip** + **fast-xml-parser**
  (in ooxml-core), **html2canvas-pro** + **jsPDF** (export)
- **oxfmt** (formatting), **oxlint** (linting): both from the [oxc](https://oxc.rs) toolchain

## Adding a New Element Type

Engine steps happen in `../ooxml-core/src/pptx/` and ship in an ooxml-core
release before the viewer steps can land here.

1. Define the interface in `core/types/elements.ts` extending `PptxElementBase`.
2. Add it to the `PptxElement` discriminated union.
3. Add a type guard in `core/types/type-guards.ts`.
4. Add a parsing module in `core/core/runtime/`.
5. Add serialization in the `*SaveElementWriter.ts` modules.
6. Add a converter processor in `converter/elements/`.
7. Release ooxml-core and bump the range in `packages/core/package.json`.
8. Add framework-independent rendering logic in `packages/shared/src/render/`,
   then wire renderers in all five bindings with per-binding and
   framework-neutral e2e coverage.
