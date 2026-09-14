# Locale reference dictionaries

This private workspace package contains the complete French, Spanish, German, and Simplified Chinese
UI dictionaries used by the demos and bundled into all five viewer packages.
This workspace is not published separately and is not a runtime dependency of
any viewer binding.

Repository workspaces reference the dictionaries by package name:

```ts
import { translationsFr } from 'pptx-viewer-locales/fr';
import { translationsEs } from 'pptx-viewer-locales/es';
import { translationsDe } from 'pptx-viewer-locales/de';
import { translationsZhCN } from 'pptx-viewer-locales/zh-CN';
```

Each language has its own entry point, and each dictionary contains every
canonical English key. External applications import dictionaries directly from
their installed viewer package:

```ts
import { translationsZhCN } from 'pptx-react-viewer/i18n/zh-CN';
import { translationsFr } from 'pptx-vue-viewer/i18n/fr';
```

The same `i18n/fr`, `i18n/es`, `i18n/de`, and `i18n/zh-CN` subpaths are available
in the Angular, Svelte, and Vanilla packages. See the
[localization guide](../../docs/guide/localization.md) for registration and Vue's
placeholder conversion.

The initial expanded translations are machine-assisted drafts built on the
existing curated demo vocabulary. Exact key and interpolation-placeholder
coverage is tested; native-speaker terminology review is still welcome.

## How to help

Native and fluent speakers can review one semantic file at a time under
`src/fr`, `src/es`, `src/de`, or `src/zh-CN`. Files are organized by product area, such as
`charts.ts`, `presenting-and-slide-show.ts`, and `text-and-equations.ts`.

1. Find the same key in `packages/shared/src/i18n/translations-en.ts` to confirm
   the English source and UI context.
2. Improve only the translated value. Keep the dotted `pptx.*` key unchanged.
3. Preserve every `{{placeholder}}` exactly, including spelling and braces.
4. Prefer terminology used by the localized Microsoft PowerPoint UI, especially
   for charts, SmartArt, animation, transitions, and master views.
5. Run the validation commands below and mention the reviewed language and
   product areas in the pull request.

```bash
bun run --filter 'pptx-viewer-locales' test
bun run --filter 'pptx-viewer-locales' typecheck
bun run --filter 'pptx-viewer-locales' build
```

The tests require exact key parity with English and verify interpolation tokens.

## Filling newly added keys

After English UI strings are added, run:

```bash
bun run locales:generate
```

The generator reads all existing semantic files first. It keeps every valid
existing translation, including reviewed values that intentionally match
English, and machine-translates only missing entries or entries with invalid
placeholders. Review generated additions before committing them. The generator
also fails when a new key prefix has not been assigned to a named section, so
the dictionaries stay organized as they grow.

## Building the public subpaths

Build this workspace before building a viewer package. `scripts/copy-subpaths.mjs`
copies its standalone runtime artifacts and declarations into each viewer's
`dist/i18n` directory after the framework build. Dictionary values remain
maintained here in one place.

From the repository root, after building the viewers, run:

```sh
bun run test:locale-subpaths
```

This packs the actual component packages, imports every language without
framework or private-workspace dependencies, and checks ESM/CommonJS, bundling,
and TypeScript declarations.
