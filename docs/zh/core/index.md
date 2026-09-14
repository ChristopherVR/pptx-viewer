---
title: 核心引擎概览
description: pptx-viewer-core 是不依赖框架的 TypeScript 引擎，在内存中解析、创建、编辑、序列化和转换 PowerPoint 文件。
---

# 核心引擎概览 {#core-engine-overview}

`pptx-viewer-core` 是处理 PowerPoint（`.pptx`）的**框架无关** TypeScript 引擎。它直接在内存中的 OpenXML ZIP 归档上解析、创建、编辑、序列化和转换文稿，无需原生依赖或浏览器 DOM。

`.pptx` 是遵循 [Office Open XML（OOXML）](https://www.ecma-international.org/publications-and-standards/standards/ecma-376/) 规范、包含 XML 文档的 ZIP 归档。本包为其提供完整的类型化 SDK，包含四项运行时依赖：处理 ZIP 的 **jszip**、解析和构建 XML 的 **fast-xml-parser**，以及独立的二进制格式包 **emf-converter** 和 **mtx-decompressor**。

::: tip 在项目中的位置
React、Vue 和 Angular 等组件渲染核心引擎生成的数据模型，MCP 工具包则将其能力提供给智能体。参见 [React 组件](/zh/react/)和 [MCP 工具](/zh/packages/mcp)。
:::

## 安装 {#install}

```bash
bun add pptx-viewer-core
# or: npm install pptx-viewer-core
```

## 能力一览 {#capability-map}

| 能力            | 入口                                             | 说明                                                                                                                                         |
| --------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **解析**        | `handler.load(buffer, options?)`                 | 打开 PPTX/PPT 归档或可移植的 `pptx-viewer-json` 文档，返回幻灯片、元素、主题、母版、版式、媒体、图表、SmartArt、批注、动画、切换和文档属性。 |
| **创建**        | `PptxHandler.create()` / `Presentation`          | 使用链式[构建器 API](/zh/core/builder)从零创建文稿。                                                                                         |
| **编辑**        | 修改 `data.slides` / `PptxXmlBuilder`            | 添加、删除和重排幻灯片，插入元素、修改文本、样式和主题，详见[编程编辑](/zh/core/editing)。                                                   |
| **保存**        | `handler.save(slides, options?)`                 | 将模型序列化为 `.pptx`、`.ppsx`、`.pptm` 或旧版 `.ppt` 字节，并保留原始内容，详见[保存](/zh/core/saving)。                                   |
| **转换**        | `PptxMarkdownConverter`                          | 将解析结果转换为 Markdown，可提取媒体并包含备注和元数据，详见[转换器](/zh/core/converter)。                                                  |
| **可移植 JSON** | `PptxJsonConverter`                              | 生成带版本、自包含的 JSON 模型，无需原归档即可重新导入。                                                                                     |
| **导出**        | `SvgExporter`                                    | 无需浏览器的 SVG 渲染，每页生成一个 `<svg>` 字符串，详见 [SVG 导出](/zh/core/svg-export)。                                                   |
| **加密与解密**  | `load({ password })` / `handler.saveEncrypted()` | 读取 standard 或 agile 加密的 PPTX，输出 agile AES-128/AES-256，详见[加密](/zh/core/encryption)。                                            |
| **主题操作**    | `handler.switchTheme()` / `switchThemePreset()`  | 动态切换配色和字体，`THEME_PRESETS` 包含 8 个预设。                                                                                          |
| **文本操作**    | `findText` / `replaceText` / `mergePresentation` | 整份文稿的搜索、替换和合并，也可通过[命令行](/zh/core/cli)使用。                                                                             |
| **校验**        | 签名和一致性工具                                 | 数字签名检测、OOXML Strict 处理，以及无障碍和验证辅助工具。                                                                                  |

## 运行环境 {#runtime-support}

引擎通过字符串和对象操作构建 XML/SVG，加载、编辑和保存路径均不依赖 DOM。

| 环境                            | 解析 / 编辑 / 保存 | SVG 导出 | Markdown 转换            | 加密                         | CLI    |
| ------------------------------- | ------------------ | -------- | ------------------------ | ---------------------------- | ------ |
| **浏览器**                      | 支持               | 支持     | 支持，内存中处理         | 支持，使用 `crypto.subtle`   | 不支持 |
| **Node 18+**                    | 支持               | 支持     | 支持，可接入磁盘适配器   | Node 19+ 支持，18 需启用标志 | 支持   |
| **Bun**                         | 支持               | 支持     | 支持，可接入磁盘适配器   | 支持                         | 支持   |
| **Deno / Workers / Serverless** | 支持               | 支持     | 支持，可接入自定义适配器 | 支持                         | 不支持 |

需要注意的平台条件包括：

- **加密**需要 `globalThis.crypto` 上的 `crypto.subtle` 和 `crypto.getRandomValues`。浏览器、Bun、Deno、Workers 和 Node 19+ 原生提供；Node 18 需要 `--experimental-global-webcrypto`。
- **写入文件**由调用方负责。引擎返回字符串或 `Uint8Array`，转换器接受可替换的 `FileSystemAdapter`。
- **CLI** 使用 `node:fs`，在 Node 或 Bun 下运行。

## 生命周期 {#lifecycle}

```
                 new PptxHandler()
                        |
        ArrayBuffer --> load(buffer, { password? })
                        |        (detect JSON, OLE2/PPT, or ZIP -> decrypt if needed -> parse
                        |         -> resolve theme/master/layout inheritance)
                        v
                    PptxData  { slides, theme, width, height, ... }
                        |
          mutate slides/elements in place  (or via PptxXmlBuilder)
                        |
        +---------------+----------------------+
        |                                      |
   save(slides, options?)          saveEncrypted(slides, password, options?)
        |                                      |
    Uint8Array (.pptx/.ppsx/.pptm)      Uint8Array (encrypted OLE2)
                        |
                  handler.dispose()   (free Blob URLs, caches, ZIP)
```

处理器持有已加载或新建文件的内存 ZIP。未修改的媒体、母版、自定义 XML 和 VBA 等在保存时原样透传，因此必须在产生数据的**同一处理器**上调用 `save()`。使用结束后调用 `dispose()` 可立即释放内存。

## 简单示例 {#quick-example}

::: code-group

```ts [Load, edit, save]
import { PptxHandler } from 'pptx-viewer-core';
import { readFile, writeFile } from 'node:fs/promises';

const file = await readFile('deck.pptx');
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

const handler = new PptxHandler();
const data = await handler.load(buffer as ArrayBuffer);

console.log(`${data.slides.length} slides, ${data.width}x${data.height}px`);

// Walk the typed element model (discriminated union, narrow on `type`)
for (const el of data.slides[0].elements) {
	if (el.type === 'text') {
		console.log('text box:', el.text);
	}
}

// Edit in place
const title = data.slides[0].elements.find((el) => el.type === 'text');
if (title && title.type === 'text') {
	title.text = 'Updated title';
}

const bytes = await handler.save(data.slides); // => Uint8Array
await writeFile('out.pptx', bytes);
handler.dispose();
```

```ts [Create from scratch]
import { PptxHandler, inchesToEmu } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Q4 Report',
	creator: 'Sales Team',
	width: inchesToEmu(13.333), // EMU; defaults to 16:9 widescreen
	height: inchesToEmu(7.5),
	initialSlideCount: 0,
	theme: { colors: { accent1: '#FF6B6B' }, fonts: { majorFont: 'Montserrat' } },
});

data.slides.push(createSlide('Title Slide').addText('Hello', { fontSize: 36 }).build());

const bytes = await handler.save(data.slides);
```

:::

`PptxHandler.create(options)` 及其别名 `PptxHandler.createBlank(options)` 均接收 `PresentationOptions`，包括以 EMU 表示的 `width`/`height`、`theme`、`title`、`creator` 和 `initialSlideCount`，返回 `{ handler, data, createSlide }`。链式接口见[构建器](/zh/core/builder)，加载流程及 `password`、`eagerDecodeImages`、`maxUncompressedBytes`、`allowExternalImages` 选项见[加载与解析](/zh/core/loading)。

::: warning 加载保护
`load()` 限制 ZIP 解压预算，默认总量 500 MiB、最多 65,536 个条目，超出时抛出 `ZipBombError`。外部 `http(s)` 图片引用默认丢弃，只有显式设置 `allowExternalImages: true` 才允许。
:::

## 主要公共导出 {#main-public-exports}

所有内容均从根入口 `pptx-viewer-core` 重新导出，请使用统一入口，不要导入内部文件。另有 `pptx-viewer-core/converter`、`pptx-viewer-core/cli` 和仅限 Node 的签名/PKI 辅助入口 `pptx-viewer-core/signature-node`。

| 导出项                                                                                                                            | 类型 | 用途                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `PptxHandler`                                                                                                                     | 类   | 加载、编辑、保存和加密的外观接口。                       |
| `Presentation`                                                                                                                    | 类   | 最高层的链式文稿构建器。                                 |
| `TextBuilder`、`ShapeBuilder`、`ImageBuilder`、`TableBuilder`、`ChartBuilder`、`ConnectorBuilder`、`MediaBuilder`、`GroupBuilder` | 类   | 第二层元素构建器，详见[构建器](/zh/core/builder)。       |
| `PptxXmlBuilder`                                                                                                                  | 类   | 在原位修改 `PptxData` 的底层链式工具。                   |
| `ThemePresets`、`THEME_PRESETS`、`SlideSizes`                                                                                     | 常量 | 8 个构建器主题预设、8 个可切换主题和 7 种 EMU 标准尺寸。 |
| `inches`、`cm`、`mm`、`pt`（转像素）；`inchesToEmu`、`cmToEmu`、`pixelsToEmu`（转 EMU）                                           | 函数 | 单位换算。                                               |
| `PptxMarkdownConverter`                                                                                                           | 类   | [Markdown 转换器](/zh/core/converter)。                  |
| `PptxJsonConverter`                                                                                                               | 类   | 带版本、自包含的 JSON 模型转换器。                       |
| `SvgExporter`                                                                                                                     | 类   | [无界面 SVG 导出](/zh/core/svg-export)。                 |
| `decryptPptx`、`encryptPptx`、`verifyPassword`、`detectFileFormat`                                                                | 函数 | [底层加密工具](/zh/core/encryption)。                    |
| `findText`、`replaceText`、`mergePresentation`                                                                                    | 函数 | 整份文稿的文本查找替换和合并。                           |
| `PptxData`、`PptxSlide`、`PptxElement`、`TextStyle`、`ShapeStyle`、`TableData`、`PptxChartData`、`PptxTheme` 等                   | 类型 | [数据模型](/zh/guide/data-model)。                       |
| `getShapeClipPath`、`evaluateGuides`、`evaluatePresetShape`、`getConnectorPathGeometry`、`getElementTransform` 等                 | 函数 | [几何工具](/zh/core/geometry)。                          |
| `parseDrawingColor` 及颜色工具                                                                                                    | 函数 | OOXML 颜色解析与变换。                                   |

## 架构速览 {#architecture-at-a-glance}

- **`PptxHandler`** 包装 `PptxHandlerCore`，后者委托给可注入的 `IPptxHandlerRuntime`。测试时可通过 `new PptxHandler({ runtime })` 提供自定义实现。
- **运行时**由 102 个职责明确的 mixin 模块组成，分别处理主题加载、元素解析、保存等。
- **类型系统**以 `PptxElement` 为中心，包含 `text`、`shape`、`connector`、`image`、`picture`、`table`、`chart`、`smartArt`、`ole`、`media`、`group`、`ink`、`contentPart`、`zoom`、`model3d` 和 `unknown` 共 16 种类型，通过 `element.type` 缩小范围，详见[数据模型](/zh/guide/data-model)。
- **EMU** 是 OOXML 原生坐标单位：1 英寸 = 914,400 EMU，1 磅 = 12,700 EMU，96 DPI 下 1 像素 = 9,525 EMU。模型同时提供像素 `data.width`/`data.height` 和原始 EMU `widthEmu`/`heightEmu`。

## 下一步 {#next-steps}

- [加载与解析](/zh/core/loading)：打开文稿并遍历模型。
- [构建器 API](/zh/core/builder)：通过链式调用创建文稿。
- [编程编辑](/zh/core/editing)：修改加载的数据。
- [保存与往返处理](/zh/core/saving)：重新序列化为 `.pptx`。
- [Markdown 转换器](/zh/core/converter)和 [SVG 导出](/zh/core/svg-export)。
- [加密](/zh/core/encryption)和[几何引擎](/zh/core/geometry)。
- [CLI](/zh/core/cli)：`pptx` 命令行工具。
