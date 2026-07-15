# Locale reference dictionaries

This private workspace package contains the complete French, Spanish, and German
UI dictionaries used by every demo application in this repository. It is not
published to npm and is not a runtime dependency of any viewer binding.

Repository workspaces reference the dictionaries by package name:

```ts
import { translationsFr } from 'pptx-viewer-locales/fr';
import { translationsEs } from 'pptx-viewer-locales/es';
import { translationsDe } from 'pptx-viewer-locales/de';
```

Each language has its own entry point, and each dictionary contains every
canonical English key. External applications should provide dictionaries through
their framework's documented i18n integration rather than depend on this private
package.

The initial expanded translations are machine-assisted drafts built on the
existing curated demo vocabulary. Exact key and interpolation-placeholder
coverage is tested; native-speaker terminology review is still welcome.

## How to help

Native and fluent speakers can review one semantic file at a time under
`src/fr`, `src/es`, or `src/de`. Files are organized by product area, such as
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
