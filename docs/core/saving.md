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
Call `save()` on the handler that loaded or created the data. It holds the in-memory ZIP - media, masters, themes, custom XML parts, VBA - that the save pipeline reuses for anything you didn't touch. Saving through a different handler would have nothing to round-trip.
:::

## What the save pipeline does

The pipeline (in `PptxHandlerRuntimeSavePipeline`) runs these stages in order:

1. **Resolve conformance** - `'preserve'` (default) keeps the Strict/Transitional class detected at load; `'strict'` / `'transitional'` force one.
2. **Reconcile the slide list** - added, removed, and reordered slides are mirrored into `ppt/presentation.xml` and its relationships; notes/handout master infrastructure is created if newly needed.
3. **Process each slide** - rebuilds the shape tree from element data: text paragraphs and run properties, shape styles, effects, transforms, relationship updates (images, charts, media, ink), animation timing trees, and notes. Newly embedded media registers its extension for step 4.
4. **Rebuild `[Content_Types].xml`** - slide overrides plus `Default` entries for every used media/ink extension.
5. **Comments** - classic comment parts are pruned/re-emitted, `ppt/commentAuthors.xml` is regenerated (or removed, including its relationship, to avoid PowerPoint's repair prompt), and modern (threaded) comments are persisted.
6. **Masters, layouts, themes** - typed mutations from the save options are applied; every master/layout/theme you did _not_ list passes through verbatim from the loaded archive.
7. **Embedded fonts** - fonts loaded with raw data are re-embedded automatically (lossless by default); the `embeddedFonts` / `embeddedFontList` options override or remove them.
8. **Presentation-level parts** - `presentation.xml` (sections, custom shows, photo album, kinsoku, modify verifier, slide size), `presProps.xml`, `viewProps.xml`, `tableStyles.xml`, document properties (`docProps/core.xml`, `app.xml`, `custom.xml`), tag collections, notes/handout masters.
9. **Charts, SmartArt, OLE** - pending chart/diagram/SmartArt XML updates are flushed and their content types ensured.
10. **Preservation passes** - custom XML parts, the thumbnail, and the VBA project are carried forward untouched; **digital signatures are stripped** (an edited package would fail validation anyway).
11. **Output format overrides** - `.ppsx` / `.pptm` content-type switches if requested.
12. **Strict conversion** - if the effective conformance is Strict, all parts are converted from Transitional back to Strict namespace URIs.
13. **ZIP hygiene** - JSZip's auto-created directory entries are removed (ISO/IEC 29500-2 forbids folder entries as parts; PowerPoint's OPC loader shows the repair dialog otherwise), then the archive is generated as a `Uint8Array`.

## Round-trip guarantees

The engine is built for _edit a fraction, keep the rest_:

| Preserved verbatim (unless you edit it)   | Rebuilt on every save                     |
| ----------------------------------------- | ----------------------------------------- |
| Slide masters and layouts                 | `ppt/presentation.xml` slide list + rels  |
| Theme parts (`ppt/theme/theme*.xml`)      | Each slide's `p:spTree` from element data |
| Media binaries (`ppt/media/*`)            | `[Content_Types].xml`                     |
| Embedded fonts (raw data re-embedded)     | Comment parts and comment authors         |
| VBA projects and custom XML parts         | Document properties                       |
| Thumbnail (`docProps/thumbnail.jpeg`)     | Chart/SmartArt parts you touched          |
| Table styles (`def` GUID, unmodelled XML) |                                           |

Anything the data model does not represent is never regenerated from scratch - it flows from the loaded ZIP into the saved one byte-for-byte.

::: warning Signatures do not survive saving
`save()` always strips XML digital signature parts, because any modification invalidates them. Re-sign the output with the `pptx-viewer-core/signature-node` helpers if you need a signed result.
:::

## OOXML Strict and Transitional

Office 365 can save files in **ISO/IEC 29500 Strict** mode, which uses `purl.oclc.org` namespace URIs instead of the common **Transitional** (ECMA-376) `schemas.openxmlformats.org` ones. On load the engine detects Strict conformance and normalizes 48 mapped namespace URI pairs (PresentationML, DrawingML families, officeDocument relationship types, schemaLibrary, descriptions) to Transitional for internal processing; on save it converts back according to the `conformance` option:

```ts
// Keep whatever the source file used (default)
await handler.save(data.slides);

// Force Strict Open XML output
await handler.save(data.slides, { conformance: 'strict' });

// Downgrade a Strict file to Transitional
await handler.save(data.slides, { conformance: 'transitional' });
```

The Open Packaging Conventions namespaces (ISO/IEC 29500-2: content types, relationships, core properties) and Markup Compatibility (ISO/IEC 29500-3: `mc:AlternateContent`) are conformance-independent and intentionally **never** remapped - real Strict files from Office keep them in canonical form, and so does this engine. The root `conformance="strict"` attribute on `p:presentation` is added or dropped to match the effective class.

## Save options

`save(slides, options?)` takes a `PptxHandlerSaveOptions` object for parts that live outside the per-slide element model. All fields are optional; omitting a field round-trips the original part untouched.

| Option                                                  | Type                                       | Purpose                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `coreProperties` / `appProperties` / `customProperties` | typed objects / array                      | Document metadata (`docProps/*.xml`).                                                                              |
| `sections`                                              | `PptxSection[]`                            | Slide section grouping.                                                                                            |
| `customShows`                                           | `PptxCustomShow[]`                         | Custom slide-show definitions.                                                                                     |
| `presentationProperties`                                | `PptxPresentationProperties`               | Show type, looping, print settings, etc.                                                                           |
| `slideMasters` / `slideLayouts`                         | `PptxSlideMaster[]` / `PptxSlideLayout[]`  | Typed mutations (clrMap, background, hf flags) applied per `path`; unlisted masters/layouts pass through verbatim. |
| `notesMaster` / `handoutMaster`                         | typed objects                              | Notes/handout master updates (incl. `slidesPerPage`).                                                              |
| `headerFooter`                                          | `PptxHeaderFooter`                         | Presentation-level header/footer flags.                                                                            |
| `viewProperties`                                        | `PptxViewProperties`                       | `ppt/viewProps.xml`.                                                                                               |
| `tags` / `customerData`                                 | arrays                                     | Tag collections (`ppt/tags/tag*.xml`) and customer-data references.                                                |
| `photoAlbum`                                            | `PptxPhotoAlbum`                           | `p:photoAlbum` metadata.                                                                                           |
| `kinsoku`                                               | `PptxKinsoku \| null`                      | East Asian line-break settings; `null` removes.                                                                    |
| `modifyVerifier`                                        | `PptxModifyVerifier \| null`               | Write-protection verifier; `null` removes it, `undefined` preserves the existing one.                              |
| `tableStyles`                                           | `ParsedTableStyleMap`                      | Table-style edits for `ppt/tableStyles.xml` (unmodelled XML preserved).                                            |
| `embeddedFonts` / `embeddedFontList`                    | `PptxEmbeddedFont[]` / `... \| null`       | Override or remove embedded fonts; default is lossless re-embedding.                                               |
| `outputFormat`                                          | `'pptx' \| 'ppsx' \| 'pptm'`               | Standard, slide-show, or macro-enabled output (see below).                                                         |
| `conformance`                                           | `'strict' \| 'transitional' \| 'preserve'` | OOXML conformance class of the output (default `'preserve'`).                                                      |

```ts
const bytes = await handler.save(data.slides, {
	coreProperties: { ...data.coreProperties, title: 'Final Report' },
	sections: data.sections,
	conformance: 'preserve',
});
```

## Output formats and byte types

The return type is always a plain `Uint8Array`, directly writable with `node:fs`, `Bun.write`, or a browser `Blob`.

| `outputFormat` | Extension | Behaviour                                                        |
| -------------- | --------- | ---------------------------------------------------------------- |
| `'pptx'`       | `.pptx`   | Standard presentation (default).                                 |
| `'ppsx'`       | `.ppsx`   | Slide-show file; opens straight into presentation mode.          |
| `'pptm'`       | `.pptm`   | Macro-enabled presentation; requires the loaded file's VBA data. |

## Writing the result

::: code-group

```ts [Node fs]
import { writeFile } from 'node:fs/promises';

const bytes = await handler.save(data.slides);
await writeFile('output.pptx', bytes);
```

```ts [Bun]
const bytes = await handler.save(data.slides);
await Bun.write('output.pptx', bytes);
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

## Saving encrypted output

To write a password-protected file, use `saveEncrypted` instead of `save`. It accepts the same save options plus an `encryption` block:

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret');
// => Uint8Array of an encrypted OLE2 package
```

See [/core/encryption](/core/encryption) for algorithm options and details.

## `exportSlides`

The handler also exposes `exportSlides(slides, options)` with
`options.format: 'pdf' | 'png' | 'svg'`, returning a `Map` keyed by slide index.

**`svg` works with no setup.** It is rendered by the same headless
[SVG exporter](/core/svg-export) the rest of this package uses, so it needs no
DOM and runs in Node, Bun, Deno and Workers:

```ts
const exports = await handler.exportSlides(data.slides, {
	format: 'svg',
	slideIndices: [0, 2],
});
for (const [index, bytes] of exports) {
	await fs.writeFile(`slide_${index}.svg`, Buffer.from(bytes));
}
// => one SVG document per exported slide
```

Hidden slides are skipped unless you pass `includeHidden: true`, so the returned
map can be smaller than `slideIndices`. Pass `width` to rescale the viewport; the
aspect ratio always comes from the deck.

**`png` and `pdf` throw.** Rasterising needs a platform backend this package
deliberately does not carry. It previously returned a correctly-keyed map of
EMPTY byte arrays plus an `EXPORT_BACKEND_UNAVAILABLE` compatibility warning,
which meant a caller who did not read the warning wrote zero-byte files and
found out much later; it now fails loudly instead. For raster output use a
viewer binding's export pipeline in a browser, or override `exportSlides` on the
runtime with your own backend (an override replaces the body, so it is
unaffected by the throw).
