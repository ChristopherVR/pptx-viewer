---
title: 什么是 pptx-viewer
description: 了解 pptx-viewer TypeScript 项目如何在 React、Vue 3、Angular、Svelte 5 和原生 JavaScript 中解析、编辑、渲染和转换 PowerPoint 文件。
---

# 什么是 pptx-viewer {#what-is-pptx-viewer}

`pptx-viewer` 是一个 TypeScript monorepo，用于在浏览器和 Node.js 中**解析、编辑、渲染和转换** Microsoft PowerPoint（`.pptx`）文件。它在内存中直接处理 OpenXML ZIP 文件，无需原生依赖。

`pptx-viewer` 支持完整的读取和保存流程：加载已有演示文稿，修改结构化数据模型，渲染幻灯片，再保存为有效的 `.pptx` 文件。**React**、**Vue 3**、**Angular** 和 **Svelte 5** 组件使用同一个核心引擎；不使用框架的项目则可以选择**原生 JavaScript** 版本。

## 主要功能 {#what-it-does}

SDK 提供九项核心能力：

1. **解析**：将 `ArrayBuffer` 中的 `.pptx` 文件解析为结构化的 [`PptxData`](/zh/guide/data-model) 模型，也支持 `.ppsx`、`.pptm`、`.potx` 和 PowerPoint 97-2003 的二进制 `.ppt` 格式。
2. **创建**：通过链式构建器 API 从零创建演示文稿。
3. **渲染**：使用 React、Vue、Angular、Svelte 或原生 JavaScript 组件呈现可交互的幻灯片。
4. **编辑**：通过代码或内置的所见即所得编辑器修改演示文稿。
5. **保存**：将修改后的内容重新保存为有效的 `.pptx` 文件。
6. **转换**：将演示文稿转换为 Markdown，并按需提取媒体文件。
7. **导出**：将幻灯片导出为图片（PNG/JPEG）、SVG、PDF、GIF 或视频。
8. **协作**：通过 Yjs CRDT 实现实时协作，并显示在线状态。
9. **加密与解密**：处理受密码保护的 PPTX 文件（AES-128/256）。

引擎支持演示文稿元素、数百种 `ST_ShapeType` 预设形状、图表、内置表格样式、SmartArt、三维模型、动画和切换（包括平滑切换）、主题、幻灯片母版、嵌入媒体、EMF/WMF 图元文件、OLE 对象、数字墨迹、数字签名、加密、VBA 宏保留以及 OOXML Strict 格式。

## 适用场景 {#who-is-it-for}

- **在产品中嵌入文档预览**：直接在 Web 应用中显示用户上传的演示文稿，无需将文件发送给转换服务。
- **构建编辑器**：各框架组件提供完整的所见即所得编辑界面，包括功能区、属性面板、撤销与重做以及协作功能，可按需启用。
- **后端处理与自动化**：核心包不依赖框架，可以在 Node.js 中运行，适合在脚本、服务器和 CI 中生成、检查、比较或转换演示文稿。
- **AI 与智能体工作流**：`pptx-viewer-mcp` 将引擎能力暴露为 MCP 工具调用，Markdown 转换器则可以生成便于大语言模型处理的文本。

## 渲染方式 {#rendering-model}

`pptx-viewer` 的常规显示不会在服务器上或 `<canvas>` 中将幻灯片转为位图，而是使用 **DOM 中的 HTML、CSS 和 SVG**：

- 文本是真正的 HTML 文本，可以选择、搜索、翻译，并由屏幕阅读器朗读。
- 形状和连接线使用 SVG，裁剪路径由几何引擎计算。
- 表格使用 HTML `<table>` 元素；图表根据解析后的数据生成内联 SVG。
- 缩放通过 CSS transform 实现，在不同缩放比例和屏幕像素密度下保持清晰。
- 每个元素都是 DOM 节点，便于实现选择、拖动控点、行内文本编辑和无障碍交互。

只有在请求位图导出时才会栅格化：PNG、JPEG、PDF、GIF 和视频导出使用 `html2canvas` 绘制 DOM。

::: tip 取舍
CSS 无法逐像素还原所有 PowerPoint 效果，例如部分混合模式和三维旋转采用近似实现。完整说明见[功能限制](/zh/guide/limitations)。
:::

## 各个包的用途 {#the-packages}

这个 monorepo 发布八个 npm 包。

| 包                                  | npm 包名                     | 用途                                                                         |
| ----------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| [**核心引擎**](/zh/core/)           | `pptx-viewer-core`           | 解析、创建、编辑、序列化和转换 PPTX 文件，不依赖框架。                       |
| [**React**](/zh/react/)             | `pptx-react-viewer`          | React 预览、编辑和放映组件，包含工具栏、属性面板、协作和导出功能。           |
| [**Vue 3**](/zh/vue/)               | `pptx-vue-viewer`            | 基于同一引擎的 Vue 3 预览和编辑组件，功能保持一致。                          |
| [**Angular**](/zh/angular/)         | `pptx-angular-viewer`        | 基于同一引擎的 Angular 预览和编辑组件，功能保持一致。                        |
| [**原生 JavaScript**](/zh/vanilla/) | `pptx-vanilla-viewer`        | 基于同一引擎的无框架版本，使用原生 DOM，通过一个工厂函数创建，无需框架依赖。 |
| [**Svelte**](/zh/svelte/)           | `pptx-svelte-viewer`         | 基于同一引擎的 Svelte 5 组件，功能保持一致。                                 |
| [**工具与 MCP**](/zh/packages/mcp)  | `pptx-viewer-mcp`            | 73 个 PPTX 工具函数、面向 AI 智能体的 MCP 服务器，以及 Y.Doc 协作编解码器。  |
| **安装工具**                        | `@christophervr/pptx-viewer` | 交互式命令行工具，帮助项目接入合适的预览组件包。                             |

### 包之间的关系 {#how-the-pieces-fit}

五个 UI 组件包都基于共享渲染层，共享渲染层再依赖核心引擎：

```
pptx-react-viewer   ┐
pptx-vue-viewer     │
pptx-angular-viewer ├── pptx-viewer-shared ── pptx-viewer-core
pptx-vanilla-viewer │                               ├── emf-converter
pptx-svelte-viewer  ┘                               └── mtx-decompressor
```

- **`pptx-viewer-core`** 负责文件格式相关的全部工作：加载和保存流程、类型化数据模型、主题解析、几何引擎、加密，以及 Markdown/SVG 转换。它不包含 UI，可以在支持 JavaScript 的环境中运行。
- **`pptx-viewer-shared`** 保存不依赖框架的预览逻辑：样式和渐变解析、图表与坐标轴计算、连接线路由、动画和平滑切换引擎，以及导出准备工作。这是一个**内部包**，不发布到 npm，而是在构建时打包到各框架组件中，无需单独安装。
- **各框架组件** 是较薄的视图层，将共享渲染数据转换为对应框架的表达方式，例如 JSX、SFC 模板、Angular 模板、Svelte runes 或原生 DOM，因此五个组件可以保持渲染结果和功能一致。
- **`emf-converter`**（将 EMF/WMF 图元文件转换为 PNG）和 **`mtx-decompressor`**（处理 MicroType Express 嵌入字体）是核心引擎依赖的独立 npm 包。
- **`pptx-viewer-mcp`** 基于 `pptx-viewer-core`，为 AI 智能体提供工具调用和协作接口。

## 最小示例 {#minimal-examples}

::: code-group

```ts [Load, edit, save]
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(arrayBuffer);

// data.slides is a typed, mutable model
data.slides[0].elements.filter((el) => el.type === 'text').forEach((el) => console.log(el.text));

const bytes = await handler.save(data.slides); // => Uint8Array (.pptx)
```

```ts [Create from scratch]
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Q4 Report',
	theme: { colors: { accent1: '#FF6B6B' } },
});

data.slides.push(createSlide('Blank').addText('Hello', { fontSize: 36 }).build());

const bytes = await handler.save(data.slides);
```

:::

## 下一步 {#next-steps}

- [安装](/zh/guide/installation)：安装所需的包并配置本地开发环境。
- [快速开始](/zh/guide/quick-start)：查看完整的使用示例。
- [架构说明](/zh/guide/architecture)：了解加载、保存流程和分层设计。
- [PptxData 数据模型](/zh/guide/data-model)：了解编辑时使用的类型化数据模型。
- [核心引擎概览](/zh/core/)：了解解析、编辑和序列化引擎。
- [React 组件概览](/zh/react/)：了解预览和编辑组件。
- [功能限制](/zh/guide/limitations)：使用前需要了解的注意事项。
