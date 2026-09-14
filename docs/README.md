# Maintaining the documentation

The documentation site uses VitePress. Its dependencies are installed in this
directory, separately from the root Bun workspaces.

## Run locally

From the repository root:

```bash
bun run docs:build   # installs docs dependencies, syncs release pages, builds site
bun run docs:dev     # starts VitePress after that initial installation
bun run docs:preview # previews the built site
```

For development without a production build first, run `bun install` in `docs/`,
then return to the root and run `bun run docs:dev`. Output goes to
`docs/.vitepress/dist/`. The deployed base path is `/pptx-viewer/`.

## Where to update content

| Content                           | Location                                                              | Check against                                                             |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Installation and package overview | Root and package `README.md` files                                    | Package manifests, exports, peer dependencies, build configuration        |
| Developer concepts                | `guide/`                                                              | Core types, shared implementation, demo configuration                     |
| Headless API                      | `core/`                                                               | `packages/core/src/index.ts`, public classes, builder and converter types |
| Binding API                       | `react/`, `vue/`, `angular/`, `svelte/`, `vanilla/`                   | Each binding's exported props, handles, callbacks, and defaults           |
| End-user workflows                | `user/`                                                               | Shared commands and the five bindings' actual UI wiring                   |
| Translations                      | `fr/`, `es/`, `de/`, `zh/`                                            | Corresponding English page and current implementation                     |
| Homepage text and examples        | `.vitepress/theme/landing/copy/` and `code/samples.ts`                | The same public APIs as the getting-started guides                        |
| Navigation                        | `.vitepress/config.ts`                                                | Existing pages and section names                                          |
| OpenXML inventory                 | `architecture/openxml-conformance.md`                                 | Schema data, parsing/saving code, and conformance tests                   |
| Animation research                | `../packages/shared/src/render/animation-ppt-formula-ground-truth.md` | Formula evaluator, playback integration, and regression tests             |

French, Spanish, and German guides cover a subset of the English site.
Simplified Chinese (`zh/`) covers the landing page, developer and user guides,
core and all five binding API references, MCP tools, the OpenXML conformance
reference, and the release overview. Generated historical release notes remain
in their original language and are linked from the Chinese release overview.
UI dictionaries in `packages/locales` are a separate system; adding a UI locale
does not automatically translate this site.

Keep translated pages aligned with their English counterparts. Preserve code
examples and API identifiers, and use explicit heading IDs matching the English
page so cross-page anchors and language switching keep working. Chinese internal
links should point to `/zh/` pages wherever a translation exists. Landing copy
lives in `.vitepress/theme/landing/copy/zh.ts`; navigation, sidebar and search
labels live in `.vitepress/locales/zh.ts` and `zh-sidebar.ts`.

## Review examples and claims

Check examples against the public entry point, not just an internal implementation.
Some hooks and services are exported only through `/internals`; do not imply they
are stable root imports. Include required CSS imports, a sized viewer container,
and the file-loading step or explicitly identify the supplied input.

The core loader accepts an `ArrayBuffer`. For a Node `Buffer`, use
`Uint8Array.from(buffer).buffer` to obtain exactly the file bytes; a pooled
`buffer.buffer` can include bytes outside the file. When editing rich text, check how the save pipeline reconciles `text` and
`textSegments`; update the segments explicitly when changing run formatting.

Distinguish parsing, preservation, editing, playback, and export. Recognition of
an OOXML construct does not establish full rendering fidelity. Document known
approximations and link to the limitation or conformance page instead of claiming
universal compatibility. Prefer source-backed descriptions over changing counts
of modules, tests, or tools.

Run `bun run docs:build` after edits, check the modified examples against types
or a small runtime exercise, and run `git diff --check`. The site's current
`ignoreDeadLinks` setting means a successful build alone does not prove every
link resolves: inspect local links and navigation as a separate check.

## Release history

`sync-changelogs.mjs` copies package changelogs into ignored `releases/*.md`
pages before development and production builds. Only `releases/index.md` is
hand-maintained. Keep historical changelogs intact; the release workflow prepends
new entries, and old tags can be pruned. Do not regenerate history from the
remaining tags or edit generated release pages as API documentation.

The Pages workflow runs for changes under `docs/` on `main`, and can also be
dispatched manually or by the release workflow. It builds the documentation and
demo applications. Root README-only changes do not trigger that path filter.
