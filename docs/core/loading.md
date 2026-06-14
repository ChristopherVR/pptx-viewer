---
title: Loading & Parsing
description: Construct a PptxHandler, load a .pptx ArrayBuffer into the structured PptxData model, and walk slides, elements, theme, and metadata.
---

# Loading & Parsing

Loading turns raw `.pptx` bytes into a fully resolved, typed [`PptxData`](/guide/data-model) object. All parsing happens in memory — no temporary files, no native code.

## Construct a handler and load

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(arrayBuffer);

console.log(`${data.slides.length} slides loaded`);
console.log(`Canvas: ${data.width} x ${data.height}`);
```

`handler.load(data, options?)` accepts an `ArrayBuffer` and returns `Promise<PptxData>`.

::: tip Keep the handler
The handler holds the in-memory ZIP. Use the **same** handler instance to later `save()`, `exportSlides()`, or fetch media via `getImageData()` / `getMediaArrayBuffer()`.
:::

## Getting an `ArrayBuffer`

The engine is environment-agnostic; you just need bytes.

::: code-group

```ts [fetch (browser/server)]
const buffer = await fetch('presentation.pptx').then((r) => r.arrayBuffer());
const data = await handler.load(buffer);
```

```ts [File input (browser)]
const file = input.files[0]; // File from <input type="file">
const buffer = await file.arrayBuffer();
const data = await handler.load(buffer);
```

```ts [Node fs]
import { readFile } from 'node:fs/promises';

const node = await readFile('presentation.pptx'); // Buffer
const buffer = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength);
const data = await handler.load(buffer as ArrayBuffer);
```

:::

## What the load pipeline does

When you call `load()`, the runtime:

1. Detects the file format. Encrypted (OLE2/CFB) files are decrypted first when a password is supplied.
2. Opens the ZIP with JSZip and parses `[Content_Types].xml` and `ppt/presentation.xml`.
3. Parses each slide master, its theme, colour map, and layouts.
4. For each slide, parses the shape tree and resolves the **layout → master → theme** style chain (see [/guide/concepts](/guide/concepts)).
5. Parses text with style inheritance, animations, transitions, and media relationships.
6. Parses comments, document properties, and embedded fonts.

The result is a single `PptxData` object holding everything needed to render, edit, or convert the deck.

## Load options

```ts
const data = await handler.load(buffer, {
	password: 'secret', // decrypt an encrypted file (see below)
	allowExternalImages: false, // default false — http(s) image URLs are dropped
	maxUncompressedBytes: 500 * 1024 * 1024, // zip-bomb guard, 500 MiB default
});
```

| Option                 | Default   | Purpose                                                                                                                                                              |
| ---------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `password`             | —         | Decrypts an encrypted package before parsing.                                                                                                                        |
| `allowExternalImages`  | `false`   | When `false`, relationship targets resolving to `http://`/`https://` are dropped from rendered slides (SSRF / privacy mitigation). Set `true` to allow them through. |
| `maxUncompressedBytes` | `500 MiB` | Total uncompressed budget. Exceeding it (or 65,536 entries) rejects with `ZipBombError`.                                                                             |
| `eagerDecodeImages`    | `false`   | Decode embedded images during load rather than lazily.                                                                                                               |

## Accessing slides, theme, and metadata

```ts
const data = await handler.load(buffer);

// Slides
const first = data.slides[0];
console.log(first.id, first.elements.length, first.notes);

// Canvas / dimensions
console.log(data.width, data.height); // pixels

// Theme
console.log(data.theme?.name);
console.log(data.theme?.fontScheme?.majorFont?.latin);

// Document metadata
console.log(data.coreProperties?.title, data.coreProperties?.creator);

// Structure
console.log(data.sections, data.slideMasters, data.slideLayouts);
```

See [/guide/data-model](/guide/data-model) for the full shape of `PptxData`, `PptxSlide`, and friends.

## Iterating elements and narrowing by `type`

Every slide's `elements` array is a list of [`PptxElement`](/guide/data-model) — a discriminated union of 16 variants. Always narrow with the `type` discriminant before touching variant-specific fields:

```ts
for (const slide of data.slides) {
	for (const el of slide.elements) {
		switch (el.type) {
			case 'shape':
			case 'text':
				console.log('text:', el.text);
				break;
			case 'image':
				console.log('image at', el.imagePath);
				break;
			case 'table':
				console.log('table rows:', el.tableData?.rows.length);
				break;
			case 'chart':
				console.log('chart type:', el.chartData?.type);
				break;
			case 'group':
				// groups nest child elements recursively
				console.log('group children:', el.children.length);
				break;
		}
	}
}
```

::: warning Narrow before access
TypeScript only exposes variant fields (like `imagePath` or `tableData`) after you've narrowed on `el.type`. This is the intended pattern — see [/guide/concepts](/guide/concepts).
:::

## Embedded media

To pull bytes for an embedded image or media file referenced by an element:

```ts
const dataUrl = await handler.getImageData(element.imagePath); // base64 data URL
const bytes = await handler.getMediaArrayBuffer(mediaPath); // ArrayBuffer
```

## Encrypted files

If the file is password-protected and you call `load()` **without** a password, the engine throws `EncryptedFileError`. Provide `options.password` to decrypt before parsing:

```ts
const data = await handler.load(buffer, { password: 'secret' });
```

See [/core/encryption](/core/encryption) for the full encryption and write-back API.
