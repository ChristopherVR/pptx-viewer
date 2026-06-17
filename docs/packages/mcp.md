---
title: MCP & Tools
description: pptx-viewer-mcp provides 24 pure PPTX manipulation tools, Zod input schemas, an MCP server, and a Y.Doc collaboration codec - all built on pptx-viewer-core.
---

# MCP & Tools

`pptx-viewer-mcp` (source lives in `packages/tools`) packages everything you need to drive PPTX edits from AI agents and collaborative runtimes: **24 pure tool functions**, **Zod schemas** for every tool input, an **MCP server**, and a **Y.Doc collaboration codec**. It is built entirely on top of [`pptx-viewer-core`](/core/).

::: tip Where this fits
The tools take the [`PptxData` model](/guide/data-model) the core engine produces, mutate it as plain in-memory data, and hand it back. They add no file I/O or framework dependencies of their own - you (or the provided MCP server / execution pipeline) decide how to load and persist.
:::

## Install

```bash
npm install pptx-viewer-mcp pptx-viewer-core
# optional - required only for the collaboration codec
npm install yjs
```

## Entry points

The package exposes four import paths:

| Entry point               | Contents                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pptx-viewer-mcp`         | The 24 tool functions + provider types + execution pipeline (`loadPresentation`, `savePresentation`, `executeToolWithContext`). |
| `pptx-viewer-mcp/schemas` | Zod schemas for every tool input.                                                                                               |
| `pptx-viewer-mcp/codec`   | `PptxCodec` - the Y.Doc ↔ PPTX-bytes codec.                                                                                     |
| `pptx-viewer-mcp/mcp`     | `createServer()` - programmatic MCP server factory.                                                                             |

## The 24 tool functions

Every tool is a **pure function**: it receives a `ToolContext`, returns a `ToolResult`, and performs no file I/O. They are grouped by concern:

| Group          | Count | Tools                                                                                                                                                                |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Slide**      | 8     | `getSlide`, `addSlide`, `deleteSlides`, `reorderSlides`, `duplicateSlide`, `updateSlideProperties`, `setSlideTransition`, `setCanvasSize`                            |
| **Element**    | 9     | `addElement`, `updateElement`, `deleteElements`, `arrangeElements`, `cloneElement`, `setElementAnimation`, `groupElements`, `ungroupElements`, `batchUpdateElements` |
| **Table**      | 2     | `updateTableCells`, `manageTableStructure`                                                                                                                           |
| **Style**      | 2     | `updateElementStyle`, `runAccessibilityCheck`                                                                                                                        |
| **Content**    | 3     | `findText`, `replaceText`, `manageComments`                                                                                                                          |
| **Conversion** | 1     | `convertToMarkdown`                                                                                                                                                  |

### Tool contract

Tools share a uniform shape defined in the package's `types`:

```ts
interface ToolContext {
	/** Current presentation data (parsed PptxData from pptx-viewer-core). */
	pptxData: PptxData;
	/** Optional: resolve external image paths to binary data. */
	resolveImage?: (path: string) => Promise<Uint8Array>;
	/** Optional: resolve external media paths to binary data. */
	resolveMedia?: (path: string) => Promise<Uint8Array>;
}

interface ToolResult<T = unknown> {
	/** The (potentially mutated) presentation data. */
	pptxData: PptxData;
	/** Tool-specific return value (slide info, element id, search results, …). */
	result: T;
	/** Whether pptxData was modified - signals the consumer to save. */
	dirty: boolean;
}
```

## Usage modes

There are three ways to use the package, from lowest-level to fully managed.

### 1. Direct tool functions

Pair a tool with `PptxHandler` from the core engine for load/save. You own the lifecycle:

```ts
import { PptxHandler } from 'pptx-viewer-core';
import { addSlide, getSlide } from 'pptx-viewer-mcp';

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

### 2. The MCP server

Run the bundled MCP server so an MCP client (Claude Desktop, Cursor, etc.) can call the tools over stdio. Add it to your client configuration:

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

The binary is also installed as **`pptx-tools`** after a global install (`npm i -g pptx-viewer-mcp`). All 24 tools are exposed over stdio under their **snake_case** names - e.g. `get_slide`, `add_slide`, `batch_update_elements`, `convert_to_markdown`. Each MCP tool accepts a `filePath` parameter; the server handles loading and saving internally.

To embed the server programmatically rather than via the CLI, use the factory from the `/mcp` entry point:

```ts
import { createServer } from 'pptx-viewer-mcp/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = createServer(); // McpServer with all 24 tools registered
await server.connect(new StdioServerTransport());
```

### 3. `executeToolWithContext` with providers

`executeToolWithContext` wraps the **load → tool → save** cycle and, when a live collaboration room is available, routes the change through a Y.Doc instead of (or in addition to) disk:

```ts
import {
	executeToolWithContext,
	replaceText,
	type ExecutionContext,
	type FileSystemProvider,
	type CollaborationProvider,
} from 'pptx-viewer-mcp';
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

When `execCtx.collaboration` is set, the pipeline **dehydrates** the current Y.Doc state before running the tool (so unsaved edits are part of the tool's view) and **re-hydrates** the room after saving (so remote peers receive the change without a file reload).

## Provider interfaces

`CollaborationProvider`, `FileSystemProvider`, and `ViewerProvider` are plain interfaces - implement them for any runtime (Node, Electron, browser, edge worker). The `ExecutionContext` bundles them together:

| Interface               | Responsibility                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `FileSystemProvider`    | `readFile(path)` / `writeFile(path, data)` - where bytes come from and go.                                                    |
| `CollaborationProvider` | Resolve the active Y.Doc room and codec for a file path (`getRoom`, `getCodec`), plus `agentOrigin(name)` for undo isolation. |
| `ViewerProvider`        | Push live updates into an open viewer (`replaceContent`, `openFile`) - used by Electron integrations.                         |
| `ExecutionContext`      | `{ filesystem, collaboration?, viewer?, agentName? }` - passed to `executeToolWithContext`.                                   |

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

A tool only reports `dirty: true` when it actually mutates the data, so `savePresentation()` runs solely when there is something to persist. Saving then branches on whether a collaboration room exists for the file.

## The `PptxCodec` collaboration codec

The `/codec` entry point exports `PptxCodec`, a bidirectional **Y.Doc ↔ PPTX-bytes** codec implementing the `FormatCodec` interface. It is what makes real-time collaborative editing of a deck possible: PPTX bytes hydrate into Yjs shared types, edits propagate through the CRDT, and the document dehydrates back to valid PPTX bytes.

```ts
import { PptxCodec, ORIGIN_FILE_LOAD } from 'pptx-viewer-mcp/codec';
import { Doc as YDoc } from 'yjs';

const codec = new PptxCodec();
const ydoc = new YDoc();

// bytes → Y.Doc shared types
await codec.hydrate(ydoc, pptxBytes, ORIGIN_FILE_LOAD);

// …collaborative edits happen on ydoc…

// Y.Doc shared types → bytes
const out = await codec.dehydrate(ydoc); // Uint8Array (valid .pptx)
```

The `FormatCodec` contract it implements:

```ts
interface FormatCodec {
	readonly formatId: string; // 'pptx'
	readonly extensions: string[]; // ['.pptx', '.ppt']
	hydrate(ydoc: YDoc, bytes: Uint8Array, origin?: string): Promise<void>;
	dehydrate(ydoc: YDoc, dirtyPaths?: string[]): Promise<Uint8Array>;
	observe(ydoc: YDoc, onChange: () => void): () => void;
}
```

The exported `ORIGIN_FILE_LOAD` constant tags the initial hydration so it can be distinguished from user edits in Yjs undo/origin handling.

## See also

- [/core/](/core/) - the engine these tools mutate (`PptxData`, `PptxHandler`).
- [/guide/data-model](/guide/data-model) - the `PptxData` / `PptxElement` model.
- [/react/collaboration](/react/collaboration) - the React side of Y.Doc collaboration.
