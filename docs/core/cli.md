---
title: CLI
description: The pptx command-line tool from pptx-viewer-core - info, export-svg, export-md, merge, find, replace, create, and diff commands for PPTX files.
---

# CLI

`pptx-viewer-core` ships a `pptx` binary for common PPTX operations from the terminal - no code required. Each command is a thin wrapper around the engine, so behaviour matches the programmatic API.

## Install / run

```bash
# One-off, no install
npx pptx info deck.pptx

# Global install
npm install -g pptx-viewer-core
pptx info deck.pptx
```

Run `pptx --help` (or `-h`) for the full usage summary.

## Commands

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

### `info`

```bash
pptx info deck.pptx
```

Prints slide count, dimensions and size type, title/creator/subject, theme name and fonts, layout and section names, total element count, and flags for hidden slides, notes, comments, macros, digital signatures, embedded fonts, and custom shows.

### `export-svg`

```bash
pptx export-svg deck.pptx ./svg-output
pptx export-svg deck.pptx ./svg-output --include-hidden
```

Writes `slide_1.svg`, `slide_2.svg`, … to the output directory (default `.`). Wraps [`SvgExporter.exportAll`](/core/svg-export).

| Flag               | Effect                 |
| ------------------ | ---------------------- |
| `--include-hidden` | Include hidden slides. |

### `export-md`

```bash
pptx export-md deck.pptx deck.md
pptx export-md deck.pptx deck.md --semantic --no-notes
```

Converts to Markdown (output path defaults to the input name with `.md`). Wraps the [Markdown converter](/core/converter).

| Flag         | Effect                                                   |
| ------------ | -------------------------------------------------------- |
| `--semantic` | Emit clean semantic Markdown instead of positioned HTML. |
| `--no-notes` | Exclude speaker notes.                                   |

### `merge`

```bash
pptx merge deck1.pptx deck2.pptx -o combined.pptx
pptx merge deck1.pptx deck2.pptx -o combined.pptx --keep-source-theme --insert-at 2
```

Appends the second file's slides into the first and writes the result. Reports merged and total slide counts.

| Flag                  | Effect                        |
| --------------------- | ----------------------------- |
| `-o <output.pptx>`    | Output file (required).       |
| `--keep-source-theme` | Keep the source deck's theme. |
| `--insert-at <index>` | 0-based insert position.      |

### `find`

```bash
pptx find deck.pptx "quarterly report"
pptx find deck.pptx "Q4" -i
```

Lists each match as `Slide N, Element <id>: "text"`.

| Flag | Effect            |
| ---- | ----------------- |
| `-i` | Case-insensitive. |

### `replace`

```bash
pptx replace deck.pptx "2025" "2026" -o updated.pptx
pptx replace deck.pptx "draft" "final" -o updated.pptx -i
```

Replaces all occurrences and writes a new file, reporting the replacement count.

| Flag               | Effect                  |
| ------------------ | ----------------------- |
| `-o <output.pptx>` | Output file (required). |
| `-i`               | Case-insensitive.       |

### `create`

```bash
pptx create -o blank.pptx --title "New Deck"
pptx create -o blank.pptx --title "New Deck" --creator "Sales Team"
```

Creates a presentation with a single blank title slide.

| Flag                 | Effect                      |
| -------------------- | --------------------------- |
| `-o <output.pptx>`   | Output file (required).     |
| `--title "Title"`    | Set the presentation title. |
| `--creator "Author"` | Set the creator.            |

### `diff`

```bash
pptx diff old.pptx new.pptx
```

Compares two decks: per-slide status (`[+]` added, `[-]` removed, `[~]` modified, `[ ]` unchanged), element-count deltas, and per-slide text differences, plus whether dimensions and theme match.

## Programmatic use

The command handlers are also exported for reuse without spawning the binary:

```ts
import { handleInfo, handleExportMd, handleDiff } from 'pptx-viewer-core/cli';

const info = await handleInfo(bytes); // InfoResult
```

Each handler takes raw bytes (`Uint8Array`) and returns a typed result (`InfoResult`, `ExportSvgResult`, `ExportMdResult`, `MergeResult`, `FindCommandResult`, `ReplaceResult`, `CreateResult`, `DiffResult`).
