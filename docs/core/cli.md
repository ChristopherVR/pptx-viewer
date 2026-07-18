---
title: CLI
description: The pptx command-line tool from pptx-viewer-core - info, export-svg, export-md, merge, find, replace, create, and diff commands for PPTX files.
---

# CLI

`pptx-viewer-core` ships a `pptx` binary (declared in the package's `bin` field, entry `packages/core/src/cli/index.ts`) for common PPTX operations from the terminal - no code required. Each command is a thin wrapper around the engine, so behaviour matches the programmatic API exactly.

## Install / run

```bash
# One-off, no install (npx runs the package's single binary)
npx pptx-viewer-core info deck.pptx

# Global install
npm install -g pptx-viewer-core
pptx info deck.pptx

# Bun
bunx pptx-viewer-core info deck.pptx
```

Run `pptx --help` (or `-h`, or no arguments) for the full usage summary. Unknown commands print the usage and exit with code 1; any command error prints `Error: <message>` and exits 1.

::: warning Not `npx pptx`
The binary is named `pptx`, but the npm _package_ is `pptx-viewer-core` - `npx pptx` would fetch an unrelated package of that name. Always run via the package name (or install globally first).
:::

## Command summary

| Command                               | Purpose                                |
| ------------------------------------- | -------------------------------------- |
| `info <file>`                         | Show presentation metadata and counts. |
| `export-svg <file> [dir]`             | Export every slide to SVG files.       |
| `export-md <file> [out.md]`           | Export the deck to Markdown.           |
| `merge <a> <b> -o <out>`              | Merge two presentations.               |
| `find <file> "text"`                  | Find text across all slides.           |
| `replace <file> "old" "new" -o <out>` | Replace text and write a new file.     |
| `create -o <out>`                     | Create a blank presentation.           |
| `diff <a> <b>`                        | Compare two presentations.             |

All commands and flags below are verified against the CLI source (`packages/core/src/cli/index.ts` and `commands.ts`).

### `info`

```bash
pptx info deck.pptx
```

Prints slide count and pixel dimensions always, then every field that exists in the file: size type, title/creator/subject, theme name, major/minor fonts, layout count and names, section count and names, total element count (recursing into groups), plus conditional lines for hidden slides, slides with notes, comment count, macros, digital signatures, embedded font count, and custom shows.

### `export-svg`

```bash
pptx export-svg deck.pptx ./svg-output
pptx export-svg deck.pptx ./svg-output --include-hidden
```

Writes `slide_1.svg`, `slide_2.svg`, ... to the output directory (default `.`, created if missing) and prints one `Written:` line per file. Wraps [`SvgExporter.exportAll`](/core/svg-export).

| Flag               | Effect                 |
| ------------------ | ---------------------- |
| `--include-hidden` | Include hidden slides. |

### `export-md`

```bash
pptx export-md deck.pptx deck.md
pptx export-md deck.pptx deck.md --semantic --no-notes
```

Converts to Markdown (output path defaults to the input name with `.md`). Wraps the [Markdown converter](/core/converter) with `includeMetadata: true` and `sourceName` set to the input basename.

| Flag         | Effect                                                   |
| ------------ | -------------------------------------------------------- |
| `--semantic` | Emit clean semantic Markdown instead of positioned HTML. |
| `--no-notes` | Exclude speaker notes.                                   |

::: info Markdown only
The CLI does not wire up a file-system adapter for the converter, so **media files are not extracted** - image references in the Markdown point at a `media/` folder that is not written. Use the converter programmatically with a `FileSystemAdapter` if you need the images on disk.
:::

### `merge`

```bash
pptx merge deck1.pptx deck2.pptx -o combined.pptx
pptx merge deck1.pptx deck2.pptx -o combined.pptx --keep-source-theme --insert-at 2
```

Appends the second file's slides into the first (via `mergePresentation`) and writes the result, reporting merged and total slide counts.

| Flag                  | Effect                                            |
| --------------------- | ------------------------------------------------- |
| `-o <output.pptx>`    | Output file (required).                           |
| `--keep-source-theme` | Keep the merged-in deck's theme on its slides.    |
| `--insert-at <index>` | 0-based insert position (default: append at end). |

### `find`

```bash
pptx find deck.pptx "quarterly report"
pptx find deck.pptx "Q4" -i
```

Case-sensitive substring search by default. Prints `Found N match(es):` then one line per match: `Slide <n>, Element <id>: "text"`. Zero matches prints `No matches found for "..."`.

| Flag | Effect            |
| ---- | ----------------- |
| `-i` | Case-insensitive. |

### `replace`

```bash
pptx replace deck.pptx "2025" "2026" -o updated.pptx
pptx replace deck.pptx "draft" "final" -o updated.pptx -i
```

Replaces all occurrences (via `replaceText`), saves through the full round-trip pipeline, and reports the replacement count.

| Flag               | Effect                  |
| ------------------ | ----------------------- |
| `-o <output.pptx>` | Output file (required). |
| `-i`               | Case-insensitive.       |

### `create`

```bash
pptx create -o blank.pptx --title "New Deck"
pptx create -o blank.pptx --title "New Deck" --creator "Sales Team"
```

Creates a presentation with a single blank title slide via `PptxHandler.createBlank`.

| Flag                 | Effect                      |
| -------------------- | --------------------------- |
| `-o <output.pptx>`   | Output file (required).     |
| `--title "Title"`    | Set the presentation title. |
| `--creator "Author"` | Set the creator.            |

The underlying `handleCreate` handler additionally supports `width`, `height`, and a full `theme` object (name, colours, fonts) when called programmatically; those are not exposed as CLI flags.

### `diff`

```bash
pptx diff old.pptx new.pptx
```

Compares two decks and prints:

- Slide counts for both files, plus whether dimensions and theme name match.
- Per-slide status markers: `[+]` added, `[-]` removed, `[~]` modified, `[ ]` unchanged, with element counts.
- Per-slide text differences as `- removed text` / `+ added text` lines.

A slide counts as _modified_ when its element count, extracted text, background colour, or layout name differs.

## Programmatic use

The command handlers are exported from the `pptx-viewer-core/cli` subpath for reuse without spawning the binary. Each takes raw bytes (`Uint8Array`) and returns a typed result:

```ts
import {
	handleInfo, //    (bytes)                          => InfoResult
	handleExportSvg, // (bytes, { slideIndices?, includeHidden? }) => ExportSvgResult
	handleExportMd, //  (bytes, { sourceName?, includeSpeakerNotes?, semanticMode?, slideRange? }) => ExportMdResult
	handleMerge, //   (targetBytes, sourceBytes, MergeOptions?) => MergeResult
	handleFind, //    (bytes, search, { caseSensitive? }) => FindCommandResult
	handleReplace, // (bytes, search, replacement, { caseSensitive? }) => ReplaceResult
	handleCreate, //  ({ title?, creator?, theme?, width?, height? }?) => CreateResult
	handleDiff, //    (bytesA, bytesB)                 => DiffResult
} from 'pptx-viewer-core/cli';

const info = await handleInfo(bytes);
console.log(info.slideCount, info.themeName, info.totalElements);
```

Result types (`InfoResult`, `ExportSvgResult`, `ExportMdResult`, `MergeResult`, `FindCommandResult`, `ReplaceResult`, `CreateResult`, `DiffResult`, `SlideDiffEntry`) are exported alongside. Commands that produce a file return `outputBytes: Uint8Array`; the find result's `matches` are `FindResult` entries with `slideIndex`, `elementId`, `segmentIndex`, `text`, and `matchIndex`.

::: tip `caseSensitive` semantics
`handleFind` / `handleReplace` default to case-sensitive substring matching. Passing `caseSensitive: false` (what the `-i` flag does) switches to an escaped, case-insensitive regex over the same needle.
:::

::: warning Importing the entry module runs it
`pptx-viewer-core/cli` is the executable entry: importing it runs its `main()` once against your process's `process.argv`, and an empty or unrecognized argument list makes it print usage and call `process.exit`. Only import this subpath in short-lived scripts where that is acceptable; in servers, wire the equivalent engine APIs (`PptxHandler`, `SvgExporter`, `PptxMarkdownConverter`, `findText`, `replaceText`, `mergePresentation`) from the package root instead.
:::
