---
title: Markdown Converter
description: Convert parsed PPTX data to Markdown with PptxMarkdownConverter - semantic vs positioned-HTML modes, media extraction, and a FileSystemAdapter for non-Node environments.
---

# Markdown Converter

`PptxMarkdownConverter` turns a parsed [`PptxData`](/guide/data-model) presentation into a Markdown document. It extends the abstract `DocumentConverter` base and dispatches each element to a dedicated processor (text, image, table, chart, SmartArt, group, media, OLE, ink, fallback).

## Constructor and `convert`

```ts
new PptxMarkdownConverter(outputDir: string, options: PptxConverterOptions, fs?: FileSystemAdapter)
```

`.convert(data: PptxData)` returns `Promise<string>` - the complete Markdown.

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter('/output', {
	sourceName: 'deck.pptx',
	includeSpeakerNotes: true,
	mediaFolderName: 'media',
	includeMetadata: true,
	semanticMode: true,
});

const markdown = await converter.convert(data);
```

::: info Parse first
The converter takes already-parsed `PptxData`, not raw bytes - load with `PptxHandler` (see [/core/loading](/core/loading)), then convert. To go straight from a file with no setup, the [CLI](/core/cli) `export-md` command wraps this for you.
:::

## `PptxConverterOptions`

The options object extends the base `ConversionOptions`.

| Field                 | Type                                          | Purpose                                                                            |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `sourceName`          | `string` (required)                           | Human-readable source file name, used in front-matter metadata.                    |
| `includeSpeakerNotes` | `boolean` (required)                          | Append speaker notes as blockquotes below each slide.                              |
| `mediaFolderName`     | `string` (required)                           | Sub-folder (relative to `outputDir`) where extracted media is written.             |
| `includeMetadata`     | `boolean` (required)                          | Prepend a YAML front-matter block of document metadata.                            |
| `semanticMode`        | `boolean` (optional)                          | `true` → clean semantic Markdown; `false`/omitted → CSS-positioned HTML (default). |
| `slideRange`          | `{ start?: number; end?: number }` (optional) | 1-based slide subset. Omit to convert all slides.                                  |

## Semantic vs positioned-HTML mode

The converter has two output strategies:

- **Positioned mode** (default, `semanticMode: false`): emits HTML `<div>` elements with absolute CSS positioning, preserving slide layout fidelity.
- **Semantic mode** (`semanticMode: true`): emits clean Markdown - headings, paragraphs, and lists - optimized for readability, search, and LLM ingestion.

::: tip Choosing a mode
Use **semantic** for text extraction, RAG/indexing, or human reading. Use **positioned** when you need the visual arrangement of the slide reflected in the output.
:::

## Media extraction and the `FileSystemAdapter`

Images are managed by an internal `MediaContext` that deduplicates identical images and maps them to files in `mediaFolderName`. To actually write media (and the Markdown) to disk, pass a `FileSystemAdapter`:

```ts
interface FileSystemAdapter {
	writeFile(path: string, content: string): Promise<void>;
	writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
	createFolder(path: string): Promise<void>;
}
```

::: info In-memory only
If you only need the Markdown string back, you can omit the adapter - `convert()` still returns the full Markdown. The adapter is required only when you want media files (and a written `.md`) on a backing store.
:::

A Node adapter is a few lines:

```ts
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const fsAdapter: FileSystemAdapter = {
	async writeFile(path, content) {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, content, 'utf8');
	},
	async writeBinaryFile(path, data) {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, data);
	},
	async createFolder(path) {
		await mkdir(path, { recursive: true });
	},
};
```

Because the adapter is just an interface, you can back it with an in-memory map, a virtual FS, S3, or any other store - which is how the converter runs in browsers and Workers.

## Runnable example

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const node = await readFile('deck.pptx');
const buffer = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength);

const handler = new PptxHandler();
const data = await handler.load(buffer as ArrayBuffer);

const fsAdapter = {
	async writeFile(p: string, c: string) {
		await mkdir(dirname(p), { recursive: true });
		await writeFile(p, c, 'utf8');
	},
	async writeBinaryFile(p: string, d: Uint8Array) {
		await mkdir(dirname(p), { recursive: true });
		await writeFile(p, d);
	},
	async createFolder(p: string) {
		await mkdir(p, { recursive: true });
	},
};

const converter = new PptxMarkdownConverter(
	'./out',
	{
		sourceName: 'deck.pptx',
		includeSpeakerNotes: true,
		mediaFolderName: 'media',
		includeMetadata: true,
		semanticMode: true,
	},
	fsAdapter,
);

const markdown = await converter.convert(data);
await writeFile('./out/deck.md', markdown, 'utf8');
```

After conversion, the instance exposes `imagesExtracted`, `mediaDir`, `slidesConverted`, and `presentationSlides` getters for reporting.

## See also

- [SVG Export](/core/svg-export) - a vector rendering of slides.
- [CLI](/core/cli) - `pptx export-md` for one-shot conversion from a file.
