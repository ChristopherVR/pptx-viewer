# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun install                  # Install all workspace dependencies
bun run build                # Build all packages (emf-converter → core → react)
bun run test                 # Run vitest across all packages
bun run typecheck            # Type-check all packages
bun run fmt                  # Format all files with oxfmt
bun run fmt:check            # Check formatting (CI-safe, no writes)
bun run lint                 # Lint with oxlint
bun run lint:fix             # Auto-fix lint issues
bun run demo                 # Start the React demo dev server (Vite, port 4173)
bun run demo:vue             # Start the Vue demo dev server (Vite, port 4175)
bun run demo:angular         # Start the Angular demo dev server (Vite, port 4174)
bun run demo:vanilla         # Start the VanillaJS demo dev server (Vite, port 4176)
bun run demo:svelte          # Start the Svelte demo dev server (Vite, port 4177)
bun run changelog:unreleased # Preview changelog notes for commits since the last release run
bun run release:plan         # Dry-run the release planner (per-package versions + bump levels)

# Per-package (run from package directory)
bun run build                # Build via tsup
bun run dev                  # Watch mode
bun run test                 # Run vitest
bun run typecheck            # Type-check
```

Build order matters: **emf-converter → mtx-decompressor → core → react**

## Monorepo Structure

```
packages/
  core/             pptx-viewer-core     – Parse, edit, serialize PPTX (framework-agnostic)
  shared/           pptx-viewer-shared   – Framework-agnostic viewer logic (INTERNAL, bundled into each binding, never published)
  locales/          pptx-viewer-locales  – Internal French, Spanish, and German demo dictionaries
  react/            pptx-viewer          – React viewer/editor component
  vue/              pptx-vue-viewer      – Vue 3 viewer/editor component
  angular/          pptx-angular-viewer  – Angular viewer/editor component
  vanilla/          pptx-vanilla-viewer  – Zero-framework (VanillaJS) viewer
  svelte/           pptx-svelte-viewer   – Svelte 5 viewer component
  emf-converter/    emf-converter        – EMF/WMF metafile → PNG converter
  mtx-decompressor/ mtx-decompressor     – MicroType Express font decompressor
  tools/            pptx-viewer-mcp      – MCP server / tooling
demos/
  demo-react/       Vite + React demo app  (port 4173)
  demo-vue/         Vite + Vue 3 demo app  (port 4175)
  demo-angular/     Vite + Angular demo app (port 4174)
  demo-vanilla/     Vite + VanillaJS demo app (port 4176)
  demo-svelte/      Vite + Svelte 5 demo app (port 4177)
```

Dependency graph: `react → core → emf-converter`. Packages use `workspace:*` protocol. Bun workspaces defined at root.

## Architecture

### Core Package (`packages/core/src/`)

- **`PptxHandler`** → public facade. Wraps `PptxHandlerCore` → `PptxHandlerRuntime`.
- **Runtime uses mixin composition**: 50+ focused modules in `core/core/runtime/` each add specific capabilities (parsing, saving, theme resolution, etc.) to `PptxHandlerRuntime`.
- **Type system** in `core/types/`: Pure interfaces, no runtime code. `PptxElement` is a discriminated union of 11 element types (`text`, `shape`, `image`, `table`, `chart`, `connector`, `group`, `smartArt`, `media`, `ink`, `ole`). Narrow with `element.type`.
- **Load pipeline**: ArrayBuffer → JSZip → parse XML (fast-xml-parser) → resolve themes/masters/layouts → `PptxData`
- **Save pipeline**: `PptxSlide[]` → serialize elements to OpenXML → rebuild rels/content types → JSZip → `Uint8Array`
- **Theme resolution chain**: Element → Placeholder → Layout → Master → Theme
- **Geometry engine** in `core/geometry/`: 200+ preset shapes, clip paths, connector routing, guide formula evaluation.
- **Converter** in `converter/`: PPTX → Markdown with registry pattern dispatch per element type.

### React Package (`packages/react/src/`)

- **`PowerPointViewer`** is the main component (forwardRef orchestrator).
- **Hooks-based architecture**: 67+ custom hooks handle all logic; components are purely presentational. Key hooks: `useViewerState`, `useEditorHistory`, `useEditorOperations`, `useLoadContent`, `useExportHandlers`, `usePresentationMode`.
- **CSS-based rendering** (not Canvas): Slides render as scaled HTML/SVG with CSS transforms. Charts render as inline SVG. Tables render as HTML `<table>`. Connectors and shapes use SVG `clip-path`.
- **Export** uses html2canvas for rasterization (PNG/PDF/GIF/video).

### EMF Converter (`packages/emf-converter/src/`)

Binary EMF/WMF → GDI record replay onto Canvas 2D → PNG data URL. Supports 300+ EMF record types, EMF+, and legacy WMF.

## Key Conventions

- **Mixin pattern**: Runtime modules are in `PptxHandlerRuntime*.ts` files. Each handles one concern. New capabilities are added as new mixins.
- **Barrel exports**: Every directory has `index.ts`. Import from barrels, not individual files.
- **Type narrowing**: Always use the `type` discriminant for `PptxElement`, e.g. `if (element.type === "image")`.
- **EMU units**: PowerPoint uses English Metric Units internally. Conversion constants in `core/constants.ts` (`EMU_PER_INCH = 914400`, `EMU_PER_POINT = 12700`, `EMU_PER_PIXEL = 9525`).
- **Service interfaces**: Services define `I*` interfaces for DI/testability.
- **File naming**: kebab-case for utilities, PascalCase for classes. Tests colocated with source (`.test.ts` suffix).
- **File size: keep every source file ≤ 300 LOC.** No `.vue` / `.ts` / `.tsx`
  source file should exceed ~300 lines (tests excluded). When a file approaches
  the limit, **split it out** rather than letting it grow: extract pure logic into
  a focused module, lift sub-views into their own components, and group related
  helpers into their own files. A component SFC that declares its own `interface`s
  or non-trivial computation is a smell; that logic belongs in a composable or a
  shared module, leaving the SFC as thin presentation. Prefer many small,
  single-purpose files over one large one.
- **Share framework-agnostic logic; default to `pptx-viewer-shared`.** The vast
  majority of each binding's code (React/Vue/Angular) is _not_ framework-specific:
  geometry, style/colour/gradient resolution, text/paragraph/bullet building,
  chart/axis maths, connector routing, animation, OMML/LaTeX, export data, etc.
  All of that belongs in **`pptx-viewer-shared`** (`packages/shared/src/render/…`),
  consumed by every binding. Only the actual view layer (SFC templates / JSX /
  Angular templates + the thin reactive wiring) should live in a binding. When
  porting or adding a feature, put the logic in shared **first**, then have each
  binding import it, do not reimplement it per framework. Treat a pure helper
  sitting inside `packages/{vue,react,angular}` as an extraction candidate.
- **UI changes must reach all five bindings.** This is a merge requirement, not
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
  - "Genuinely framework-specific" means Angular change detection, Svelte 5
    runes, React effect ordering, and the like. A wrong colour, a mis-clipped
    shape, an off-by-one drag handle, or a dialog that does not open is almost
    never framework-specific.
  - See `CONTRIBUTING.md` (the parity rule + decision table) for the version
    external contributors are held to.
- **No em-dashes; use ASCII punctuation.** Never write the em-dash character
  (`—`, U+2014) anywhere: source, comments, JSDoc, docs/READMEs, commit
  messages, or UI copy. Use a colon, comma, semicolon, parentheses, or a
  spaced hyphen instead, whichever reads naturally. The only
  exception is functional UI/test content that intentionally renders or
  asserts the character (e.g. a `'—'` "no value" marker, a placeholder
  option label). The pre-commit tooling does not catch em-dashes, so keeping
  them out is on you.

## Branching & Git Workflow

This repo uses **trunk-based development**: commit directly to `main`. **Do not
create feature branches unless the user explicitly asks for one.** This overrides
any default "branch before committing" assumption.

> ⚠️ The working tree is sometimes **shared by parallel agent sessions** (e.g.
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
  (see `cliff.toml` → `commit_parsers`). `feat`/`fix`/`perf`/`refactor` are
  user-facing; `chore(deps)` groups dependency bumps.
- **scope**: optional, the affected package/area: `core`, `react`, `vue`,
  `shared`, `emf`, `mtx`, `tools`, `ci`, `deps`, etc. Use it; the changelog
  bolds it.
- **subject**: imperative mood, lower-case, no trailing period. Keep the first
  line ≤ ~72 chars.
- **breaking changes**: append `!` after the type/scope (`feat(core)!: …`) or
  add a `BREAKING CHANGE:` footer.

Examples (from history): `feat(core): typed xml-access helpers`,
`fix(react): remove dead table-cell comparisons`, `chore(deps): update all
dependencies to latest`.

**Authoring tip (tooling):** when committing via a multi-line message, use a
real heredoc or `git commit -F <file>`; do **not** wrap the message in
`@'…'@` (PowerShell here-string syntax); under `bash`/`sh` the stray `@`
characters leak into the subject and break Conventional Commit parsing. End
commit messages with the required `Co-Authored-By:` trailer.

## Tech Stack

- **TypeScript 6.0** (strict mode), **Bun** (package manager/runtime), **tsup** (bundler → ESM + CJS)
- **React 19**, **Framer Motion**, **Tailwind CSS 4**, **Lucide React**
- **Vitest** (testing), **JSZip** (ZIP), **fast-xml-parser** (XML), **html2canvas** + **jsPDF** (export)
- **Vite** (demo app dev server)
- **oxfmt** (formatting), **oxlint** (linting): both from the [oxc](https://oxc.rs) toolchain

## Adding a New Element Type

1. Define interface in `packages/core/src/core/types/elements.ts` extending `PptxElementBase`
2. Add to `PptxElement` discriminated union
3. Add type guard in `type-guards.ts`
4. Add parsing module in `core/core/runtime/`
5. Add serialization in `*SaveElementWriter.ts`
6. Add React renderer in `packages/react/src/viewer/components/elements/`
7. Add converter processor in `packages/core/src/converter/elements/`
