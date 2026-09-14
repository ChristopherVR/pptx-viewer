---
title: MCP 与工具
description: pptx-viewer-mcp 基于 pptx-viewer-core，提供 67 个纯 PPTX 操作工具、Zod 输入模式、MCP 服务器和 Y.Doc 协作编解码器。
---

# MCP 与工具 {#mcp-tools}

`pptx-viewer-mcp`（源码位于 `packages/tools`）为 AI 智能体和协作运行时驱动 PPTX 编辑提供工具：**67 个纯工具函数**、每个工具输入的 **Zod 模式**、一个 **MCP 服务器**，以及 **Y.Doc 协作编解码器**。它完全基于 [`pptx-viewer-core`](/zh/core/) 构建。

::: tip 适用位置
工具接受核心引擎生成的 [`PptxData` 模型](/zh/guide/data-model)，将其作为普通内存数据修改，再交还给调用方。工具本身不引入文件 I/O 或框架依赖；由你或所提供的 MCP 服务器、执行流程决定如何加载和持久化。
:::

## 安装 {#install}

```bash
npm install pptx-viewer-mcp pptx-viewer-core
# optional - required only for the collaboration codec
npm install yjs
```

## 入口 {#entry-points}

组件包提供四个导入路径：

| 入口                      | 内容                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pptx-viewer-mcp`         | 67 个工具函数、提供程序类型和执行流程（`loadPresentation`、`savePresentation`、`executeToolWithContext`）。 |
| `pptx-viewer-mcp/schemas` | 每个工具输入的 Zod 模式。                                                                                   |
| `pptx-viewer-mcp/codec`   | `PptxCodec`，Y.Doc 与 PPTX 字节之间的编解码器。                                                             |
| `pptx-viewer-mcp/mcp`     | `createServer()`，以编程方式创建 MCP 服务器的工厂函数。                                                     |

## 67 个工具函数 {#the-67-tool-functions}

每个工具都是**纯函数**：接收 `ToolContext`，返回 `ToolResult`，不执行文件 I/O。按职责分组如下：

| 分组             | 数量 | 工具                                                                                                                                                                                                                                                                                                                    |
| ---------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **幻灯片**       | 8    | `getSlide`, `addSlide`, `deleteSlides`, `reorderSlides`, `duplicateSlide`, `updateSlideProperties`, `setSlideTransition`, `setCanvasSize`                                                                                                                                                                               |
| **元素**         | 12   | `addElement`, `updateElement`, `renameElement`, `deleteElements`, `arrangeElements`, `cloneElement`, `setElementAnimation`, `groupElements`, `ungroupElements`, `batchUpdateElements`, `setElementLockT`, `replaceGeometry`                                                                                             |
| **表格**         | 2    | `updateTableCells`, `manageTableStructure`                                                                                                                                                                                                                                                                              |
| **表格样式**     | 4    | `setTableStyleSection`, `createTableStyle`, `deleteTableStyle`, `assignTableStyle`                                                                                                                                                                                                                                      |
| **图表**         | 14   | `createChart`, `updateChart`, `addChartSeriesT`, `removeChartSeriesT`, `updateChartSeriesData`, `listChartUserShapesT`, `addChartUserShapeT`, `updateChartUserShapeT`, `removeChartUserShapeT`, `formatChartDataPoint`, `formatChartDataLabel`, `formatChartSeries`, `setChartHelperLineT`, `setChartColorMapOverrideT` |
| **样式与主题**   | 5    | `updateElementStyle`, `applyThemePreset`, `updateThemeColors`, `updateThemeFonts`, `getThemeInfo`                                                                                                                                                                                                                       |
| **布局与模板**   | 4    | `applyLayout`, `getLayouts`, `applyTemplateT`, `findPlaceholdersT`                                                                                                                                                                                                                                                      |
| **内容**         | 5    | `findText`, `replaceText`, `manageComments`, `manageHyperlinks`, `manageSmartArt`                                                                                                                                                                                                                                       |
| **节**           | 1    | `manageSections`                                                                                                                                                                                                                                                                                                        |
| **元数据与属性** | 4    | `getMetadata`, `updateMetadata`, `getPresentationProperties`, `updatePresentationProperties`                                                                                                                                                                                                                            |
| **验证与修复**   | 3    | `runAccessibilityCheck`, `validatePresentation`, `repairPresentation`                                                                                                                                                                                                                                                   |
| **转换与导出**   | 5    | `convertToMarkdown`, `exportToSvg`, `exportSlideSvg`, `exportToJson`, `importFromJson`                                                                                                                                                                                                                                  |

组件包还导出 `mergePresentationT` 和 `diffPresentationsT`，用于合并和比较流程。这两个是普通函数，不会注册到 MCP 服务器。

### 工具约定 {#tool-contract}

工具具有统一结构，定义在包的 `types` 中：

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

## 使用方式 {#usage-modes}

从底层调用到完整托管，共有三种使用方式。

### 1. 直接调用工具函数 {#_1-direct-tool-functions}

将工具与核心引擎的 `PptxHandler` 配合使用，完成加载和保存。生命周期由你管理：

```ts
import fs from 'node:fs/promises';

import { PptxHandler } from 'pptx-viewer-core';
import { addSlide, getSlide } from 'pptx-viewer-mcp';

// Load (slice: a Node Buffer's .buffer can be a larger pooled ArrayBuffer)
const handler = new PptxHandler();
const bytes = await fs.readFile('deck.pptx');
const pptxData = await handler.load(
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);

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

### 2. MCP 服务器 {#_2-the-mcp-server}

运行包内的 MCP 服务器，让 MCP 客户端（Claude Desktop、Cursor 等）通过 stdio 调用工具。将其添加到客户端配置：

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

全局安装（`npm i -g pptx-viewer-mcp`）后，也会安装名为 **`pptx-tools`** 的可执行命令。全部 67 个工具都以 **snake_case** 名称通过 stdio 暴露，例如 `get_slide`、`add_slide`、`batch_update_elements`、`convert_to_markdown`。每个 MCP 工具接受 `filePath` 参数，服务器在内部处理加载和保存。

如需通过代码嵌入服务器，而非使用 CLI，可以使用 `/mcp` 入口的工厂函数：

```ts
import { createServer } from 'pptx-viewer-mcp/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = createServer(); // McpServer with all 67 tools registered
await server.connect(new StdioServerTransport());
```

### 3. 配合提供程序使用 `executeToolWithContext` {#_3-executetoolwithcontext-with-providers}

`executeToolWithContext` 封装**加载 → 工具 → 保存**周期；存在活动协作房间时，会通过 Y.Doc 传递变化，替代或补充磁盘写入：

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

设置 `execCtx.collaboration` 后，流程在运行工具之前将当前 Y.Doc 状态**转换回数据**，让工具看到尚未保存的编辑；保存后再将数据**重新写入**房间，让远程参与者无需重新加载文件即可收到变化。

## 提供程序接口 {#provider-interfaces}

`CollaborationProvider`、`FileSystemProvider` 和 `ViewerProvider` 都是普通接口，可以为任意运行时实现，包括 Node、Electron、浏览器和边缘 Worker。`ExecutionContext` 将它们组合起来：

| 接口                    | 职责                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `FileSystemProvider`    | `readFile(path)` / `writeFile(path, data)`，决定字节的来源和去向。                                            |
| `CollaborationProvider` | 根据文件路径解析活动 Y.Doc 房间和编解码器（`getRoom`、`getCodec`），并通过 `agentOrigin(name)` 隔离撤销来源。 |
| `ViewerProvider`        | 将实时更新推入已打开的查看器（`replaceContent`、`openFile`），用于 Electron 集成。                            |
| `ExecutionContext`      | `{ filesystem, collaboration?, viewer?, agentName? }`，传给 `executeToolWithContext`。                        |

## 架构 {#architecture}

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

工具只有实际修改数据时才报告 `dirty: true`，因此 `savePresentation()` 只在确有内容需要持久化时运行。保存随后根据文件是否存在协作房间选择不同流程。

## `PptxCodec` 协作编解码器 {#the-pptxcodec-collaboration-codec}

`/codec` 入口导出 `PptxCodec`，它是实现 `FormatCodec` 接口的双向 **Y.Doc ↔ PPTX 字节**编解码器。它让演示文稿的实时协同编辑成为可能：将 PPTX 字节写入 Yjs 共享类型，通过 CRDT 传播编辑，再将文档转换回有效的 PPTX 字节。

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

它实现的 `FormatCodec` 约定如下：

```ts
interface FormatCodec {
	readonly formatId: string; // 'pptx'
	readonly extensions: string[]; // ['.pptx', '.ppt']
	hydrate(ydoc: YDoc, bytes: Uint8Array, origin?: string): Promise<void>;
	dehydrate(ydoc: YDoc, dirtyPaths?: string[]): Promise<Uint8Array>;
	observe(ydoc: YDoc, onChange: () => void): () => void;
}
```

导出的 `ORIGIN_FILE_LOAD` 常量标记首次数据写入，使 Yjs 的撤销和来源处理能够区分初始加载与用户编辑。

## 另请参阅 {#see-also}

- [核心引擎](/zh/core/)：这些工具操作的引擎（`PptxData`、`PptxHandler`）。
- [数据模型](/zh/guide/data-model)：`PptxData` / `PptxElement` 模型。
- [React 实时协作](/zh/react/collaboration)：Y.Doc 协作的 React 集成。
