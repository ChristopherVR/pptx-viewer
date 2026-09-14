---
title: Markdown 转换器
description: 使用 PptxMarkdownConverter 将解析后的 PPTX 数据转换为 Markdown，了解语义模式、定位 HTML 模式、媒体提取以及非 Node 环境中的 FileSystemAdapter。
---

# Markdown 转换器 {#markdown-converter}

`PptxMarkdownConverter` 将解析后的 [`PptxData`](/zh/guide/data-model) 演示文稿转换为 Markdown 文档。它继承抽象基类 `DocumentConverter<PptxData>`，并将每个幻灯片元素分发给 `ElementProcessorRegistry` 中注册的专用处理器。

## 构造函数与 `convert` {#constructor-and-convert}

```ts
new PptxMarkdownConverter(outputDir: string, options: PptxConverterOptions, fs?: FileSystemAdapter)
```

`.convert(data: PptxData)` 返回 `Promise<string>`，内容为完整的 Markdown。

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

::: info 先解析再转换
转换器接受已经解析的 `PptxData`，而非原始字节。先用 `PptxHandler` 加载（参见[加载与解析](/zh/core/loading)），再进行转换。如果希望直接从字节转换而无需额外配置，可以使用 `pptx-viewer-core/cli` 中的 `handleExportMd`，或 [CLI](/zh/core/cli) 的 `export-md` 命令。
:::

## `PptxConverterOptions` {#pptxconverteroptions}

选项对象继承基础 `ConversionOptions`（已对照 `packages/core/src/converter` 验证）：

| 字段                  | 类型                                       | 来源 | 用途                                                                          |
| --------------------- | ------------------------------------------ | ---- | ----------------------------------------------------------------------------- |
| `mediaFolderName`     | `string`（必填）                           | 基类 | 提取的媒体写入此子目录，路径相对于 `outputDir`。                              |
| `includeMetadata`     | `boolean`（必填）                          | 基类 | 在开头添加包含文档元数据的 YAML front matter 块。                             |
| `outputPath`          | `string`（可选）                           | 基类 | 设置此项并提供适配器后，`convert()` 还会将 Markdown 写入该路径。              |
| `sourceName`          | `string`（必填）                           | pptx | 易于阅读的源文件名，用于 front matter 元数据。                                |
| `includeSpeakerNotes` | `boolean`（必填）                          | pptx | 在每张幻灯片下方以引用块形式附加演讲者备注。                                  |
| `semanticMode`        | `boolean`（可选）                          | pptx | `true`：纯净的语义化 Markdown；`false` 或省略：通过 CSS 定位的 HTML（默认）。 |
| `slideRange`          | `{ start?: number; end?: number }`（可选） | pptx | 从 1 开始计数的幻灯片范围，自动限制在有效边界内。省略时转换全部幻灯片。       |

## 输出结构 {#output-structure}

`convert()` 按固定顺序组装文档：

1. 可选的 **YAML front matter**（`includeMetadata: true`）。
2. 按顺序排列的幻灯片，以 `---` 水平线分隔。幻灯片属于具名的**节**时，在该节的第一张幻灯片前插入 `# SectionName` 标题。
3. 每张幻灯片下方以引用块表示的演讲者备注（`includeSpeakerNotes: true`）。
4. 如果演示文稿定义了**页眉或页脚**，在结尾附加摘要（`**Header:** ... | **Footer:** ...`）。

### Front matter 元数据 {#front-matter-metadata}

设置 `includeMetadata: true` 时，front matter 包含源文档中存在的所有下列字段（值会转义，避免恶意文稿元数据伪造 YAML 键）：

- 始终包含：`source`、`format: "pptx"`、`slides`、`converted`（ISO 时间戳）。
- 核心属性：`title`、`author`、`subject`、`description`、`category`、`lastModifiedBy`、`revision`。
- 应用属性：`application`、`editingMinutes`、`words`、`paragraphs`。
- 演示文稿级属性：`dimensions`（`960x540`）、`sections`、`customProperties`、`showType`、`loopContinuously`、`advanceMode`、`narration`、`animation`、`theme`、`fonts`、`embeddedFonts`、`customShows`。
- 安全标记：`warning_passwordProtected`、`warning_macros`。

## 语义模式与定位 HTML 模式 {#semantic-vs-positioned-html-mode}

转换器提供两种输出策略：

- **定位模式**（默认，`semanticMode: false`）：输出采用 CSS 绝对定位的 HTML `<div>` 元素，保留幻灯片布局。
- **语义模式**（`semanticMode: true`）：输出清晰的 Markdown 标题、段落和列表，适合阅读、搜索和供大语言模型处理。

::: tip 选择模式
文本提取、RAG、索引或人工阅读适合使用**语义模式**。需要在输出中体现幻灯片的视觉排布时，使用**定位模式**。
:::

## 元素处理器注册表 {#the-element-processor-registry}

每个 `PptxElement` 按类型分发给十种已注册处理器之一（均位于 `packages/core/src/converter/elements/`）：**文本**、**图片**、**表格**、**图表**、**SmartArt**、**组合**（递归）、**媒体**、**OLE**、**墨迹**，以及处理未匹配类型的**回退处理器**。`SlideProcessor` 负责协调每张幻灯片的转换，`TextSegmentRenderer` 处理富文本片段，包括粗体、斜体、超链接（`javascript:` 等不安全协议会替换为 `#`）和**公式**；公式通过 `OmmlLatexConverter` 从 OMML 转换为 LaTeX。

`DocumentConverter` 和 `SlideProcessor` 通过 `pptx-viewer-core/converter` 子路径导出，供自定义转换器使用。`ElementProcessorRegistry` 和内置元素处理器属于 `PptxMarkdownConverter` 的内部实现，应使用导出的基类，不要依赖该注册表。

## 媒体提取与 `FileSystemAdapter` {#media-extraction-and-the-filesystemadapter}

图片由内部 `MediaContext` 管理，它会对相同图片去重，并映射到 `outputDir/mediaFolderName` 下的文件。要将媒体和 Markdown 实际写入存储，请传入 `FileSystemAdapter`：

```ts
interface FileSystemAdapter {
	writeFile(path: string, content: string): Promise<void>;
	writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
	createFolder(path: string): Promise<void>;
}
```

::: info 仅在内存中转换
如果只需要 Markdown 字符串，可以省略适配器。`convert()` 仍然返回完整 Markdown，图片引用指向 `mediaFolderName`。只有需要写出媒体文件（以及设置 `outputPath` 时的 `.md` 文件）时，才需要适配器。
:::

Node 适配器只需几行代码：

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

适配器只是一个接口，因此可以接入内存映射、虚拟文件系统、S3 或任何其他存储。这也使转换器能够运行在浏览器和 Worker 中。

## 可运行示例 {#runnable-example}

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

转换完成后，实例提供以下统计 getter（均已验证）：`imagesExtracted`（去重后的图片数量）、`mediaDir`（媒体目录路径，未写出图片时为 `null`）、`slidesConverted`（范围筛选后的幻灯片数量），以及 `presentationSlides`（源文档中的总数）。

## 另请参阅 {#see-also}

- [SVG 导出](/zh/core/svg-export)：将幻灯片渲染为矢量图。
- [CLI](/zh/core/cli)：使用 `pptx export-md` 直接转换文件。注意：CLI 只写出 `.md`，不会传入文件系统适配器，因此不会提取媒体。
