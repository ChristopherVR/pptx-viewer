# Contributing to pptx-viewer

Thanks for wanting to help. This document covers how to get set up, the rules
that are load-bearing (breaking them breaks releases or ships a half-finished
feature), and what reviewers will check on your PR.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first. Found a security
vulnerability rather than a bug? Do **not** open a public issue: see
[SECURITY.md](SECURITY.md).

---

## Table of contents

- [Getting set up](#getting-set-up)
- [The parity rule (read this before writing UI code)](#the-parity-rule-read-this-before-writing-ui-code)
- [Where code belongs](#where-code-belongs)
- [Testing](#testing)
- [Running the demos](#running-the-demos)
- [Commit conventions](#commit-conventions)
- [Code style](#code-style)
- [Opening a pull request](#opening-a-pull-request)

---

## Getting set up

**Prerequisites:** [Bun](https://bun.sh/) (package manager and runtime) and
Node.js 22+.

```bash
git clone https://github.com/ChristopherVR/pptx-viewer.git
cd pptx-viewer

bun install
bun run build      # core -> shared -> locales -> mcp -> the five bindings
bun run test
bun run typecheck
bun run lint
bun run fmt:check
```

Build order matters: `core -> shared -> locales -> mcp -> react / vue / angular / vanilla / svelte`.

External contributors work on a fork: fork the repo, branch off `main`, and open
a PR back to `ChristopherVR/pptx-viewer:main`. (Maintainers with write access
commit directly to `main`; this repo is trunk-based internally.)

---

## The parity rule (read this before writing UI code)

This project ships **the same viewer/editor through five bindings**:

| Package            | npm name              | Framework |
| ------------------ | --------------------- | --------- |
| `packages/react`   | `pptx-react-viewer`   | React     |
| `packages/vue`     | `pptx-vue-viewer`     | Vue 3     |
| `packages/angular` | `pptx-angular-viewer` | Angular   |
| `packages/svelte`  | `pptx-svelte-viewer`  | Svelte 5  |
| `packages/vanilla` | `pptx-vanilla-viewer` | Zero-deps |

A user on Svelte is entitled to exactly the feature set a user on React gets.
Divergence between bindings is the single most expensive kind of debt in this
repo, so parity is a **merge requirement**, not a nice-to-have.

### If you are adding a UI feature

**It must land in all five bindings in the same PR.**

A new ribbon control, dialog, inspector panel, context-menu entry, keyboard
shortcut, gesture, or on-canvas affordance is not "done" when it works in React.
The expected shape of the change is:

1. **Logic goes in `pptx-viewer-shared` first**
   (`packages/shared/src/render/...`). Geometry, style/colour resolution, text
   and paragraph building, chart maths, connector routing, animation, export
   data, state machines, command definitions: none of that is
   framework-specific.
2. **Each binding imports the shared module** and adds only its view layer:
   JSX / SFC template / Angular template / Svelte markup / DOM construction,
   plus the thin reactive wiring.
3. **Add tests in every binding** (see [Testing](#testing)), plus a
   framework-neutral e2e spec so the feature is proven in all five demos.
4. **Add i18n keys for every locale** if the feature has user-visible copy
   (see below).

Reimplementing the same pure helper five times will be sent back. If you find
yourself copy-pasting logic from `packages/react` into `packages/vue`, that
logic belongs in `packages/shared`.

### If you are fixing a UI bug

**Check whether the same defect exists in the other four bindings, and say so in
the PR.**

Most UI bugs in this repo are structural: they came from a shared module, or
from four bindings independently making the same mistake while porting from the
React reference. A fix in one binding usually applies to the rest.

Your PR description must answer, explicitly:

- Which bindings did you actually check for this bug?
- Which ones were affected?
- Are they all fixed here? If not, **why**, and where is the tracking issue?

Fix every affected binding in the same PR where practical. If one is genuinely
blocked (an upstream framework limitation, a much larger refactor), that is
fine, but file an issue and link it. Silently fixing one binding is what causes
the drift.

### Decision table

| Change                                           | Where the logic lives | Bindings to touch       | Tests required                                 |
| ------------------------------------------------ | --------------------- | ----------------------- | ---------------------------------------------- |
| New UI feature (control, dialog, panel, gesture) | `pptx-viewer-shared`  | **All five**            | Unit per binding + shared unit + e2e spec      |
| UI fix reproducible in >1 binding                | `pptx-viewer-shared`  | **All affected**        | Regression test per affected binding (+ e2e)   |
| UI fix genuinely specific to one framework       | That binding          | Just that one           | Regression test in that binding; PR says why   |
| Parsing / serialization / geometry               | `pptx-viewer-core`    | None (bindings inherit) | Unit in `packages/core`, round-trip if on save |
| Docs, README, examples                           | n/a                   | n/a                     | n/a                                            |

"Genuinely specific to one framework" means something like Angular change
detection, Svelte 5 runes, or a React `useEffect` ordering issue. A wrong
colour, a mis-clipped shape, an off-by-one in a drag handle, or a dialog that
does not open is almost never framework-specific.

### i18n

Adding an English key to `packages/shared/src/i18n/translations-en.ts` requires
matching entries under `packages/locales/src/{de,es,fr}/`.
`packages/locales/src/locales.test.ts` fails the build if any locale is missing
a canonical key. Never hardcode a user-visible string: route it through
`t()` / `translate`.

---

## Where code belongs

```
packages/
  core/      pptx-viewer-core     Parse, edit, serialize PPTX (framework-agnostic)
  shared/    pptx-viewer-shared   Framework-agnostic viewer logic (PRIVATE, bundled into each binding)
  locales/   pptx-viewer-locales  de/es/fr dictionaries (PRIVATE)
  react/     pptx-react-viewer    React binding
  vue/       pptx-vue-viewer      Vue 3 binding
  angular/   pptx-angular-viewer  Angular binding
  vanilla/   pptx-vanilla-viewer  Zero-framework binding
  svelte/    pptx-svelte-viewer   Svelte 5 binding
  tools/     pptx-viewer-mcp      MCP server / tooling
  cli/       @christophervr/pptx-viewer
```

Rules of thumb:

- **PPTX in / PPTX out** goes in `core`. Anything about the OpenXML file itself:
  parsing, theme resolution, geometry presets, serialization, round-trip.
- **How the deck behaves** goes in `shared`. Anything a viewer needs but that
  does not care which framework renders it.
- **How the deck looks in this framework** goes in the binding, and should be
  thin. A component that declares its own interfaces or does non-trivial
  computation is a smell: move that into a shared module or a composable.

`pptx-viewer-shared` is **private and never published**. It is inlined into each
binding at build time (Angular vendors its source into
`src/internal/shared-src`). Adding a new export from `shared` requires
`bun run build` in `packages/shared` before the React and Angular demos will see
it.

---

## Testing

Every PR should carry tests proportional to the parity table above.

```bash
bun run test                       # vitest across all packages
cd packages/react && bun run test  # a single package
bun run e2e                        # Playwright, all five demo projects
bun run e2e -- --project=svelte    # a single framework
bun run e2e:install                # one-time Playwright browser install
```

### Unit tests

Colocated with source, `.test.ts` suffix. Vitest.

### e2e tests

Playwright specs live in `e2e/`. **Product specs must be framework-neutral**:
one spec runs against all five demos, selected by Playwright project. This is
enforced by a contract check that runs as part of `bun run e2e`:

```bash
bun run e2e:contract   # scripts/check-e2e-neutrality.mjs
```

It rejects specs that hardcode a demo port (4173-4177) or a framework-specific
selector (`pptx-react-*`, `pptx-ng-*`, `pptxv`, and so on) outside of a
project-conditional branch. `e2e/ribbon-tab-parity.spec.ts` is the reference for
how a legitimately framework-aware comparison is written.

Specs prefixed `capture-` are documentation asset generators, not product tests,
and are exempt.

**A UI feature PR without an e2e spec is how a binding quietly falls behind.**
If a feature is worth adding to five bindings, it is worth one neutral spec.

---

## Running the demos

```bash
bun run demo           # React     :4173
bun run demo:angular   # Angular   :4174
bun run demo:vue       # Vue 3     :4175
bun run demo:vanilla   # VanillaJS :4176
bun run demo:svelte    # Svelte 5  :4177
```

The demos serve `e2e/fixtures` as their public dir, and the landing page's
"or create a New Presentation" button gives you an editable deck without needing
a file.

### Read this before debugging a demo

The demos do **not** all resolve packages the same way, and the difference
decides whether your edit is live on reload or needs a build first.

| Specifier                     | react      | vue        | angular      | vanilla    | svelte     |
| ----------------------------- | ---------- | ---------- | ------------ | ---------- | ---------- |
| the binding (`pptx-*-viewer`) | source     | source     | **`dist`**   | source     | source     |
| `pptx-viewer-core`            | source     | source     | source       | source     | source     |
| `pptx-viewer-shared`          | **`dist`** | source     | **vendored** | source     | source     |
| `pptx-viewer-locales`         | source     | source     | **`dist`**   | source     | source     |
| `pptx-viewer-mcp`             | **`dist`** | **`dist`** | **`dist`**   | **`dist`** | **`dist`** |

Anything marked `dist` resolves to built output, so **source edits are invisible
until you build that package**:

- **Angular** reads `packages/angular/dist` (ng-packagr). Editing
  `packages/angular/src` changes nothing on screen until you run `bun run build`
  in `packages/angular`. This is the most common way to waste an hour concluding
  "my change does not work in Angular".
- **`pptx-viewer-mcp`** is aliased by no demo but is imported by
  `packages/shared/src/ai/tools/mcp-registry.ts`, so a stale
  `packages/tools/dist` **breaks all five demos at once** with
  `Module "path" has been externalized for browser compatibility`. The giveaway
  is a demo that renders only its version footer. Fix with `bun run build` in
  `packages/tools`.
- After adding a **new export to `shared`**, build `packages/shared` once or the
  React and Angular demos will not see it.

Two more traps:

- **Zombie Vite servers** keep serving stale code after a refactor. Check with
  `netstat -ano | findstr ":4173 :4174 :4175 :4176 :4177"` (or `lsof -i` on
  Unix) and kill the PID rather than debugging code that is not running.
- **Stale Vite dep caches** produce bogus framework-internal stack traces.
  Delete the demo's `node_modules/.vite` and restart before believing a trace
  that points inside Svelte, Angular, or Vue itself.

---

## Commit conventions

Commits **must** follow [Conventional Commits](https://www.conventionalcommits.org).
This is load-bearing, not cosmetic: each package is versioned and released
independently, and **the bump level is derived from your commit type**. A
mislabelled commit mis-versions a published package, and a non-conforming commit
is silently dropped from the changelog.

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: `feat` (minor bump), `fix` / `perf` / `refactor` / `docs` / `test` /
  `build` / `ci` / `style` / `chore` / `revert` (patch bump). A `!` after the
  type/scope or a `BREAKING CHANGE:` footer bumps major.
- **scope**: the package or area: `core`, `react`, `vue`, `angular`, `svelte`,
  `vanilla`, `shared`, `tools`, `cli`, `ci`, `deps`.
- **subject**: imperative, lower-case, no trailing period, first line under
  ~72 chars.

Which package a commit versions is decided by the **paths it touches**, so keep
a commit within one package where practical. A parity PR spanning five bindings
is best split into one commit per binding plus one for `shared`.

Examples: `feat(core): typed xml-access helpers`,
`fix(react): remove dead table-cell comparisons`,
`fix(vue): apply the same clip-path fix as react`.

---

## Code style

Formatting and linting come from the [oxc](https://oxc.rs) toolchain:

```bash
bun run fmt        # oxfmt, writes
bun run fmt:check  # CI-safe
bun run lint       # oxlint
bun run lint:fix
```

A `lint-staged` pre-commit hook runs on commit. Two things it will not catch:

- **It skips `.vue` files.** Its glob covers only js/ts extensions, so an oxlint
  warning inside an SFC sails through the hook and fails `bun run lint` in CI.
  Lint Vue changes explicitly before pushing.
- **It does not catch em-dashes.** See below.

House rules:

- **No `any`.** Use concrete types, `unknown` plus narrowing, or the `XmlObject`
  alias for parsed XML.
- **Keep every source file at or under ~300 LOC** (tests excluded). When a file
  approaches the limit, split it: extract pure logic into a focused module, lift
  sub-views into their own components. Prefer many small single-purpose files.
- **Barrel exports.** Every directory has an `index.ts`; import from barrels.
- **Narrow `PptxElement` on the `type` discriminant**, e.g.
  `if (element.type === "image")`.
- **EMU units.** PowerPoint measures in English Metric Units; constants live in
  `core/constants.ts` (`EMU_PER_INCH = 914400`, `EMU_PER_POINT = 12700`,
  `EMU_PER_PIXEL = 9525`).
- **No em-dashes.** Never write `-` U+2014 anywhere: source, comments, JSDoc,
  docs, commit messages, or UI copy. Use a colon, comma, semicolon, parentheses,
  or a spaced hyphen. The only exception is functional content that
  intentionally renders or asserts the character.
- **File naming**: kebab-case for utilities, PascalCase for classes.

---

## Opening a pull request

Before you push:

```bash
bun run lint && bun run fmt:check && bun run typecheck && bun run test
bun run e2e          # if you touched anything user-visible
```

Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md) honestly. The parity
section is the part reviewers read first: if you touched UI, tell us which
bindings you checked, not just which ones you changed.

What gets a PR sent back, in rough order of frequency:

1. A UI feature or fix in one binding with no statement about the other four.
2. Pure logic duplicated into a binding instead of extracted to `shared`.
3. A non-conforming commit message (it will mis-version a release).
4. New English i18n keys with no `de`/`es`/`fr` entries.
5. A source file pushed well past 300 LOC instead of split.
6. Em-dashes.

Questions are welcome: open an issue or a draft PR early rather than building
something large in the wrong place.
