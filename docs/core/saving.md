---
title: Saving & Round-tripping
description: Serialize a PptxData model back to a valid .pptx with handler.save(), with full round-trip fidelity, OOXML Strict normalization, and disk/browser output.
---

# Saving & Round-tripping

`handler.save(slides, options?)` serializes your (possibly edited) slides back into a valid `.pptx` ZIP archive and returns a `Uint8Array`.

```ts
const bytes = await handler.save(data.slides); // => Uint8Array
```

::: tip Use the originating handler
Call `save()` on the handler that loaded or created the data. It holds the in-memory ZIP — media, masters, themes, custom XML parts, VBA — that the save pipeline reuses for anything you didn't touch.
:::

## What the save pipeline rebuilds

When you call `save()`, the runtime:

1. Reconciles the slide list — added, removed, and reordered slides — and updates `ppt/presentation.xml`.
2. For each slide, rebuilds the shape tree from element data: serializes text paragraphs and run properties, writes shape styles, effects, and transforms, updates relationships (images, charts, media), writes animation timing trees, and updates notes.
3. Rebuilds `[Content_Types].xml` and writes document properties and comments.
4. **Preserves** VBA macros and custom XML parts that the model doesn't represent.
5. Generates the ZIP with DEFLATE compression and returns the bytes.

## Round-trip safety

The engine is built for full round-trips: load a deck, edit a fraction of it, save, and everything you didn't touch passes through verbatim. Unmodelled parts (macros, custom XML, masters/layouts you didn't change) are carried forward from the loaded archive rather than regenerated.

## OOXML Strict ↔ Transitional normalization

Office 365 can save files in **ISO/IEC 29500 Strict** mode, which uses different namespace URIs than the common **Transitional** (ECMA-376) format. On load the engine maps 46+ namespace URI pairs (Strict → Transitional); on save it converts back. This is automatic.

::: warning
Features that rely on strict-only extensions **outside** the mapped namespace set may not round-trip. See [/guide/limitations](/guide/limitations).
:::

## Save options

`save(slides, options?)` accepts a `PptxHandlerSaveOptions` object for persisting parts that live outside the per-slide element model — for example:

| Option                                                                                     | Purpose                                                                                                         |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `coreProperties` / `appProperties` / `customProperties`                                    | Document metadata.                                                                                              |
| `sections`                                                                                 | Slide section grouping.                                                                                         |
| `customShows`                                                                              | Custom slide-show definitions.                                                                                  |
| `presentationProperties`                                                                   | Show type, loop, etc.                                                                                           |
| `slideMasters` / `slideLayouts`                                                            | Typed mutations to masters/layouts (clrMap, background, hf flags). Anything not listed passes through verbatim. |
| `headerFooter`, `notesMaster`, `handoutMaster`, `viewProperties`, `tags`, `modifyVerifier` | Other presentation-level parts.                                                                                 |

```ts
const bytes = await handler.save(data.slides, {
	coreProperties: { ...data.coreProperties, title: 'Final Report' },
	sections: data.sections,
});
```

## Writing the result

::: code-group

```ts [Node fs]
import { writeFile } from 'node:fs/promises';

const bytes = await handler.save(data.slides);
await writeFile('output.pptx', bytes);
```

```ts [Browser download]
const bytes = await handler.save(data.slides);
const blob = new Blob([bytes], {
	type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'output.pptx';
a.click();
URL.revokeObjectURL(url);
```

:::

## Exporting individual slides

To export selected slides as standalone `.pptx` files:

```ts
const exports = await handler.exportSlides(data.slides, { slideIndexes: [0, 2] });
// => Map<number, Uint8Array> keyed by slide index
```

## Saving encrypted output

To write a password-protected file, use `saveEncrypted` instead of `save`:

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret');
// => Uint8Array of an encrypted OLE2 package
```

See [/core/encryption](/core/encryption) for algorithm options and details.
