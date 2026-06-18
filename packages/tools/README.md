# pptx-viewer-mcp

[![npm](https://img.shields.io/npm/v/pptx-viewer-mcp.svg)](https://www.npmjs.com/package/pptx-viewer-mcp)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

PPTX manipulation for AI agents: 25 pure tool functions, Zod input schemas, a ready-to-run [MCP](https://modelcontextprotocol.io) server, and a Y.Doc collaboration codec — all built on the [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine.

- **Live demo:** https://christophervr.github.io/pptx-viewer/demo/
- **Docs:** https://christophervr.github.io/pptx-viewer/

## Quick start (MCP server)

No clone, no build — point your MCP client at the published binary via `npx`:

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

This works in Claude Desktop, Claude Code, Cursor, and any MCP-compatible client. The core engine (`pptx-viewer-core`) ships as a dependency, so `npx` pulls it in automatically — there is nothing else to install. Just add the config above and restart your client.

All 25 tools are exposed over stdio in snake_case (e.g. `add_slide`, `batch_update_elements`). Every tool takes a `filePath` argument; the server handles load and save internally. File access is scoped to a root directory (`PPTX_TOOLS_ROOT`, defaulting to the process working directory) and restricted to `.pptx` / `.ppt` files.

> After a global install (`npm i -g pptx-viewer-mcp`) the same server is available as the `pptx-tools` binary.

## Install as a library

```sh
npm install pptx-viewer-mcp
# optional — only needed for the Y.Doc collaboration codec
npm install yjs
```

Installing `pptx-viewer-mcp` pulls in the `pptx-viewer-core` engine
automatically — it is a regular dependency, so there is no separate install
step. The engine is referenced rather than bundled into the package, keeping a
single shared core version across the viewer, tools, and your app.

## Exports

| Entry point               | Contents                                                |
| ------------------------- | ------------------------------------------------------- |
| `pptx-viewer-mcp`         | 25 tool functions + provider types + execution pipeline |
| `pptx-viewer-mcp/schemas` | Zod schemas for every tool input                        |
| `pptx-viewer-mcp/codec`   | `PptxCodec` — Y.Doc ↔ PPTX bytes codec                  |
| `pptx-viewer-mcp/mcp`     | `createServer()` — programmatic MCP server factory      |

## Tools

| Group          | Tools                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Slide (8)      | `getSlide` `addSlide` `deleteSlides` `reorderSlides` `duplicateSlide` `updateSlideProperties` `setSlideTransition` `setCanvasSize`                           |
| Element (9)    | `addElement` `updateElement` `deleteElements` `arrangeElements` `cloneElement` `setElementAnimation` `groupElements` `ungroupElements` `batchUpdateElements` |
| Table (2)      | `updateTableCells` `manageTableStructure`                                                                                                                    |
| Style (2)      | `updateElementStyle` `runAccessibilityCheck`                                                                                                                 |
| Content (3)    | `findText` `replaceText` `manageComments`                                                                                                                    |
| Conversion (1) | `convertToMarkdown`                                                                                                                                          |

## Usage

### Call tools directly

Every tool is a pure function — no file I/O, no framework dependencies.

```ts
import { PptxHandler } from 'pptx-viewer-core';
import { addSlide, getSlide } from 'pptx-viewer-mcp';

const handler = new PptxHandler();
const bytes = await fs.readFile('deck.pptx');
const pptxData = await handler.load(bytes.buffer);

const ctx = { pptxData };
const { pptxData: updated, dirty } = addSlide(ctx, { insertAfterIndex: 0 });

if (dirty) {
	const out = await handler.save(updated.slides);
	await fs.writeFile('deck.pptx', out);
}

const { result } = getSlide(ctx, { slideIndex: 0 });
console.log(result.elements);
```

### Wrap load → tool → save with `executeToolWithContext`

`executeToolWithContext` handles the load/save cycle and, when a collaboration
room is supplied, routes changes through a live Y.Doc instead of the disk.

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

When `collaboration` is provided on the `ExecutionContext`, the current Y.Doc
state is dehydrated before the tool runs and re-hydrated after saving, so remote
peers receive the change without a file reload.

## Architecture

```
ToolContext { pptxData }
        │
        ▼
tool function  →  ToolResult { pptxData, result, dirty }
                        │
                        ▼  (when dirty)
              savePresentation()
                ├─ collaboration room → hydrate Y.Doc → broadcast
                └─ no room → writeFile to disk
```

`CollaborationProvider`, `FileSystemProvider`, and `ViewerProvider` are plain
interfaces — implement them for any runtime (Node, Electron, browser, edge worker).

## Development

```sh
bun run build      # tsup → dist/
bun run typecheck  # tsc --noEmit
bun run test       # vitest run
```

## License

Apache-2.0
