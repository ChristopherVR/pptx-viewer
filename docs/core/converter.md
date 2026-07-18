---
title: Markdown Converter
description: Convert parsed PPTX data to Markdown with PptxMarkdownConverter - semantic vs positioned-HTML modes, media extraction, and a FileSystemAdapter for non-Node environments.
---

# Markdown Converter

`PptxMarkdownConverter` turns a parsed [`PptxData`](/guide/data-model) presentation into a Markdown document. It extends the abstract `DocumentConverter<PptxData>` base and dispatches each slide element to a dedicated processor registered in an `ElementProcessorRegistry`.

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
The converter takes already-parsed `PptxData`, not raw bytes - load with `PptxHandler` (see [/core/loading](/core/loading)), then convert. To go straight from bytes with no setup, use `handleExportMd` from `pptx-viewer-core/cli` or the [CLI](/core/cli) `export-md` command.
:::

## `PptxConverterOptions`

The options object extends the base `ConversionOptions` (verified against `packages/core/src/converter`):

| Field                 | Type                                          | From | Purpose                                                                          |
| --------------------- | --------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `mediaFolderName`     | `string` (required)                           | base | Sub-folder (relative to `outputDir`) where extracted media is written.           |
| `includeMetadata`     | `boolean` (required)                          | base | Prepend a YAML front-matter block of document metadata.                          |
| `outputPath`          | `string` (optional)                           | base | If set (and an adapter is provided), `convert()` also writes the Markdown here.  |
| `sourceName`          | `string` (required)                           | pptx | Human-readable source file name, used in front-matter metadata.                  |
| `includeSpeakerNotes` | `boolean` (required)                          | pptx | Append speaker notes as blockquotes below each slide.                            |
| `semanticMode`        | `boolean` (optional)                          | pptx | `true`: clean semantic Markdown; `false`/omitted: CSS-positioned HTML (default). |
| `slideRange`          | `{ start?: number; end?: number }` (optional) | pptx | 1-based slide subset, clamped to valid bounds. Omit to convert all slides.       |

## Output structure

`convert()` assembles the document in a fixed order:

1. Optional **YAML front matter** (`includeMetadata: true`).
2. Slides in order, separated by `---` horizontal rules. When a slide belongs to a named **section**, a `# SectionName` heading is inserted before its first slide.
3. Speaker notes as blockquotes under each slide (`includeSpeakerNotes: true`).
4. A trailing presentation **header/footer** summary (`**Header:** ... | **Footer:** ...`) when the deck defines one.

### Front-matter metadata

With `includeMetadata: true`, the front matter includes every field that exists in the source (values are escaped so hostile deck metadata cannot forge YAML keys):

- Always: `source`, `format: "pptx"`, `slides`, `converted` (ISO timestamp).
- Core properties: `title`, `author`, `subject`, `description`, `category`, `lastModifiedBy`, `revision`.
- App properties: `application`, `editingMinutes`, `words`, `paragraphs`.
- Presentation-level: `dimensions` (`960x540`), `sections`, `customProperties`, `showType`, `loopContinuously`, `advanceMode`, `narration`, `animation`, `theme`, `fonts`, `embeddedFonts`, `customShows`.
- Security flags: `warning_passwordProtected`, `warning_macros`.

## Semantic vs positioned-HTML mode

The converter has two output strategies:

- **Positioned mode** (default, `semanticMode: false`): emits HTML `<div>` elements with absolute CSS positioning, preserving slide layout fidelity.
- **Semantic mode** (`semanticMode: true`): emits clean Markdown - headings, paragraphs, and lists - optimized for readability, search, and LLM ingestion.

::: tip Choosing a mode
Use **semantic** for text extraction, RAG/indexing, or human reading. Use **positioned** when you need the visual arrangement of the slide reflected in the output.
:::

## The element processor registry

Each `PptxElement` is dispatched by type to one of ten registered processors (all in `packages/core/src/converter/elements/`): **text**, **image**, **table**, **chart**, **SmartArt**, **group** (recursive), **media**, **OLE**, **ink**, and a **fallback** for anything unmatched. A `SlideProcessor` orchestrates per-slide conversion and a `TextSegmentRenderer` handles rich text runs - bold/italic, hyperlinks (unsafe schemes like `javascript:` are collapsed to `#`), and **equations**, which are converted from OMML to LaTeX via `OmmlLatexConverter`.

The registry, base class, and processors are exported (`ElementProcessorRegistry` via the `pptx-viewer-core/converter` subpath), so you can subclass `DocumentConverter` and register your own processors for custom output formats.

## Media extraction and the `FileSystemAdapter`

Images are managed by an internal `MediaContext` that deduplicates identical images and maps them to files under `outputDir/mediaFolderName`. To actually write media (and the Markdown) to a backing store, pass a `FileSystemAdapter`:

```ts
interface FileSystemAdapter {
	writeFile(path: string, content: string): Promise<void>;
	writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
	createFolder(path: string): Promise<void>;
}
```

::: info In-memory only
If you only need the Markdown string back, omit the adapter - `convert()` still returns the full Markdown, with image references pointing into `mediaFolderName`. The adapter is required only when you want media files (and, with `outputPath`, the `.md` itself) written out.
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
		slideRange: { start: 1, end: 10 },
	},
	fsAdapter,
);

const markdown = await converter.convert(data);
await writeFile('./out/deck.md', markdown, 'utf8');

console.log(
	`${converter.slidesConverted}/${converter.presentationSlides} slides, ` +
		`${converter.imagesExtracted} images in ${converter.mediaDir ?? '(none)'}`,
);
```

After conversion, the instance exposes reporting getters (all verified): `imagesExtracted` (deduplicated image count), `mediaDir` (media folder path or `null` when no images were written), `slidesConverted` (after the range filter), and `presentationSlides` (total in the source).

## See also

- [SVG Export](/core/svg-export) - a vector rendering of slides.
- [CLI](/core/cli) - `pptx export-md` for one-shot conversion from a file (note: the CLI writes only the `.md`; it does not pass a file-system adapter, so media is not extracted).
