# pptx-viewer-mcp

[![npm](https://img.shields.io/npm/v/pptx-viewer-mcp.svg)](https://www.npmjs.com/package/pptx-viewer-mcp)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Edit PowerPoint files from an AI agent. It ships a ready-to-run [MCP](https://modelcontextprotocol.io) server that gives an agent 54 PowerPoint editing tools (for example "add a slide" or "replace text"). The same tools are also available as plain functions you can call yourself, along with their Zod input schemas and a codec for real-time collaboration (Y.Doc). The [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine is bundled in, so a single install gives you everything and you never install the core separately.

![An AI agent calling validated MCP tools to edit and save a PowerPoint file](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/mcp-tools.svg)

- **Live demo:** https://christophervr.github.io/pptx-viewer/demo/
- **Docs:** https://christophervr.github.io/pptx-viewer/

## Quick start

This package is, first and foremost, an MCP server. The recommended way to use it is to point an MCP client at the published binary. Calling the tools as a library is a secondary, lower-level option (see [Use as a library](#use-as-a-library)).

### 1. Run as an MCP server (recommended)

No clone, no build, no separate core install. Point your MCP client at the published binary via `npx`:

```json
{
	"mcpServers": {
		"pptx": {
			"command": "npx",
			"args": ["pptx-viewer-mcp"]
		}
	}
}
```

That is the entire setup. `npx` downloads `pptx-viewer-mcp` and its bundled `pptx-viewer-core` engine on first run, so there is nothing else to install. Add the config above, restart your client, and the tools are available.

This works in Claude Desktop, Claude Code, Cursor, and any MCP-compatible client. All 54 tools are exposed over stdio in snake_case (for example `add_slide`, `batch_update_elements`). Every tool takes a `filePath` argument and the server handles load and save internally. File access is scoped to a root directory (`PPTX_TOOLS_ROOT`, defaulting to the process working directory) and restricted to `.pptx` and `.ppt` files.

> If you prefer a global install (`npm i -g pptx-viewer-mcp`), the same server is available as the `pptx-tools` binary. Point `command` at `pptx-tools` with no args.

### 2. Use as a library (advanced)

If you are embedding PPTX editing in your own app instead of running the MCP server, install the package once:

```sh
npm install pptx-viewer-mcp
# optional, only for the Y.Doc collaboration codec:
npm install yjs
```

The `pptx-viewer-core` engine is a regular dependency, so it installs automatically. You import everything you need (tools and the engine) from `pptx-viewer-mcp`, with no separate `pptx-viewer-core` install or import:

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { PptxHandler, addSlide, getSlide } from 'pptx-viewer-mcp';

const handler = new PptxHandler();
const bytes = await readFile('deck.pptx');
const pptxData = await handler.load(bytes.buffer);

const ctx = { pptxData };
const { pptxData: updated, dirty } = addSlide(ctx, { insertAfterIndex: 0 });

if (dirty) {
	const out = await handler.save(updated.slides);
	await writeFile('deck.pptx', out);
}

const { result } = getSlide(ctx, { slideIndex: 0 });
console.log(result.elements);
```

See [Use as a library](#use-as-a-library) below for the higher-level `executeToolWithContext` helper that handles the load and save cycle for you.

## Exports

| Entry point               | Contents                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pptx-viewer-mcp`         | 54 tool functions, the `PptxHandler` engine, provider types, and the execution pipeline               |
| `pptx-viewer-mcp/schemas` | Zod schemas for every tool input                                                                      |
| `pptx-viewer-mcp/codec`   | `PptxCodec`, the Y.Doc to PPTX bytes codec                                                            |
| `pptx-viewer-mcp/mcp`     | The runnable stdio server entry (what `npx pptx-viewer-mcp` executes); importing it starts the server |

## Tools

| Group                     | Tools                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Slide (8)                 | `getSlide` `addSlide` `deleteSlides` `reorderSlides` `duplicateSlide` `updateSlideProperties` `setSlideTransition` `setCanvasSize`                           |
| Element (9)               | `addElement` `updateElement` `deleteElements` `arrangeElements` `cloneElement` `setElementAnimation` `groupElements` `ungroupElements` `batchUpdateElements` |
| Table (2)                 | `updateTableCells` `manageTableStructure`                                                                                                                    |
| Style (2)                 | `updateElementStyle` `runAccessibilityCheck`                                                                                                                 |
| Content (3)               | `findText` `replaceText` `manageComments`                                                                                                                    |
| Chart (5)                 | `createChart` `updateChart` `addChartSeries` `removeChartSeries` `updateChartSeriesData`                                                                     |
| Theme (4)                 | `getThemeInfo` `applyThemePreset` `updateThemeColors` `updateThemeFonts`                                                                                     |
| SmartArt (1)              | `manageSmartArt`                                                                                                                                             |
| Template & layout (4)     | `findPlaceholders` `applyTemplate` `getLayouts` `applyLayout`                                                                                                |
| Metadata & properties (4) | `getMetadata` `updateMetadata` `getPresentationProperties` `updatePresentationProperties`                                                                    |
| Sections & hyperlinks (2) | `manageSections` `manageHyperlinks`                                                                                                                          |
| Geometry & locking (2)    | `replaceGeometry` `setElementLock`                                                                                                                           |
| Validation (2)            | `validatePresentation` `repairPresentation`                                                                                                                  |
| Export & conversion (5)   | `convertToMarkdown` `exportToSvg` `exportSlideSvg` `exportToJson` `importFromJson`                                                                           |

## Use as a library

These APIs back the MCP server. Reach for them when you embed PPTX editing directly rather than running the server.

### Call tools directly

Each tool is a plain function: it takes the presentation data in and returns the changed data out, without reading or writing files itself and without depending on any framework. The basic load, edit, save loop is shown in [Use as a library (advanced)](#2-use-as-a-library-advanced) above.

### Wrap load, tool, and save with `executeToolWithContext`

`executeToolWithContext` handles the load and save cycle and, when a collaboration room is supplied, routes changes through a live Y.Doc instead of the disk.

```ts
import {
	executeToolWithContext,
	type ExecutionContext,
	type FileSystemProvider,
	replaceText,
} from 'pptx-viewer-mcp';
import { readFile, writeFile } from 'node:fs/promises';

const filesystem: FileSystemProvider = {
	readFile: (p) => readFile(p),
	writeFile: (p, data) => writeFile(p, data),
};

const result = await executeToolWithContext('deck.pptx', { filesystem }, (ctx) =>
	replaceText(ctx, { find: 'Draft', replace: 'Final', caseSensitive: false }),
);

console.log(result.replacements, result.savedToDisk);
```

When you supply `collaboration` on the `ExecutionContext`, the tool reads the current shared (Y.Doc) state before running and writes the result back into it after saving, so other people in the session see the change without reloading the file.

## Architecture

```
ToolContext { pptxData }
        |
        v
tool function  ->  ToolResult { pptxData, result, dirty }
                        |
                        v  (when dirty)
              savePresentation()
                |- collaboration room -> hydrate Y.Doc -> broadcast
                '- no room -> writeFile to disk
```

`CollaborationProvider`, `FileSystemProvider`, and `ViewerProvider` are plain interfaces. Implement them for any runtime (Node, Electron, browser, or edge worker).

## Development

```sh
bun run build      # tsup -> dist/
bun run typecheck  # tsc --noEmit
bun run test       # vitest run
```

## License

Apache-2.0
