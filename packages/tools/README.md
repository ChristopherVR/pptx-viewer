# @pptx-viewer/tools

Pure tool functions, Zod schemas, a Y.Doc collaboration codec, and an MCP server for PPTX manipulation — all built on top of `pptx-viewer-core`.

## Installation

```sh
npm install @pptx-viewer/tools pptx-viewer-core
# optional — required only for the collaboration codec
npm install yjs
```

## Exports

| Entry point                  | Contents                                                |
| ---------------------------- | ------------------------------------------------------- |
| `@pptx-viewer/tools`         | 24 tool functions + provider types + execution pipeline |
| `@pptx-viewer/tools/schemas` | Zod schemas for every tool input                        |
| `@pptx-viewer/tools/codec`   | `PptxCodec` — Y.Doc ↔ PPTX bytes codec                  |
| `@pptx-viewer/tools/mcp`     | `createServer()` — programmatic MCP server factory      |

## Tool reference

**Slide (8):** `getSlide`, `addSlide`, `deleteSlides`, `reorderSlides`, `duplicateSlide`, `updateSlideProperties`, `setSlideTransition`, `setCanvasSize`

**Element (9):** `addElement`, `updateElement`, `deleteElements`, `arrangeElements`, `cloneElement`, `setElementAnimation`, `groupElements`, `ungroupElements`, `batchUpdateElements`

**Table (2):** `updateTableCells`, `manageTableStructure`

**Style (2):** `updateElementStyle`, `runAccessibilityCheck`

**Content (3):** `findText`, `replaceText`, `manageComments`

**Conversion (1):** `convertToMarkdown`

---

## Quick start

### 1. Using tool functions directly

Every tool is a pure function — no file I/O, no framework dependencies.

```ts
import { PptxHandler } from 'pptx-viewer-core';
import { addSlide, getSlide } from '@pptx-viewer/tools';

// Load
const handler = new PptxHandler();
const bytes = await fs.readFile('deck.pptx');
const pptxData = await handler.load(bytes.buffer);

// Run a tool
const ctx = { pptxData };
const { pptxData: updated, dirty } = addSlide(ctx, { insertAfterIndex: 0 });

// Save when dirty
if (dirty) {
	const out = await handler.save(updated.slides);
	await fs.writeFile('deck.pptx', out);
}

// Inspect a slide
const { result } = getSlide(ctx, { slideIndex: 0 });
console.log(result.elements);
```

### 2. Using the MCP server

Add to your MCP client configuration (Claude Desktop, Cursor, etc.):

```json
{
	"mcpServers": {
		"pptx": {
			"command": "npx",
			"args": ["@pptx-viewer/tools"]
		}
	}
}
```

The binary is also available as `pptx-tools` after a global install. All 24 tools are exposed over stdio with the same names in snake_case (e.g. `add_slide`, `batch_update_elements`). Every tool accepts a `filePath` parameter — the server handles load/save internally.

### 3. Using `executeToolWithContext` with providers

`executeToolWithContext` wraps the load → tool → save cycle and routes through a live Y.Doc collaboration room when one is available.

```ts
import {
	executeToolWithContext,
	type ExecutionContext,
	type FileSystemProvider,
	type CollaborationProvider,
} from '@pptx-viewer/tools';
import { replaceText } from '@pptx-viewer/tools';
import { readFile, writeFile } from 'node:fs/promises';

// Minimal file-system-only provider
const filesystem: FileSystemProvider = {
	readFile: (p) => readFile(p),
	writeFile: (p, data) => writeFile(p, data),
};

const execCtx: ExecutionContext = { filesystem };

const result = await executeToolWithContext('deck.pptx', execCtx, (ctx) =>
	replaceText(ctx, { find: 'Draft', replace: 'Final', caseSensitive: false }),
);

console.log(result.replacements, result.savedToDisk);
```

When `execCtx.collaboration` is provided, `executeToolWithContext` automatically dehydrates the current Y.Doc state before running the tool and re-hydrates the room after saving, so remote peers receive the change without a file reload.

---

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

`CollaborationProvider`, `FileSystemProvider`, and `ViewerProvider` are plain interfaces — implement them for any runtime (Node, Electron, browser, edge worker).

---

## Development

```sh
bun run build      # tsup → dist/
bun run typecheck  # tsc --noEmit
bun run test       # vitest run
```

## License

MIT
