---
title: SVG 导出
description: 使用无需浏览器 DOM 的 SvgExporter 将幻灯片导出为独立 SVG 字符串，作为位图导出的矢量替代方案。
---

# SVG 导出 {#svg-export}

`SvgExporter` 无需浏览器 DOM，即可将解析后的幻灯片渲染为 **SVG XML 字符串**。输出通过字符串拼接构建，不需额外依赖，可在 Node、Bun、Deno、Workers 和服务端流程等 JavaScript 环境中运行。

::: tip 矢量输出
这是无需界面和额外依赖的逐页矢量导出方式。各框架组件的 PNG、PDF、GIF 和视频导出通过 html2canvas 栅格化当前 DOM，需要浏览器；`SvgExporter` 无需浏览器。参见 [React 组件](/zh/react/)。
:::

## API {#api}

`SvgExporter` 包含两个静态方法，对应 `packages/core/src/converter/SvgExporter.ts`：

```ts
class SvgExporter {
	static exportSlide(
		slide: PptxSlide,
		width: number,
		height: number,
		options?: SvgExportOptions,
	): string;

	static exportAll(data: PptxData, options?: SvgExportOptions): string[];
}
```

- `exportSlide`：将一页渲染为完整 `<svg>` 文档，包含 `xmlns`、`xmlns:xlink`、`viewBox` 和明确的 `width`/`height`。视口使用像素，通常传入 `data.width` / `data.height`。
- `exportAll`：遍历 `data.slides`，按 `slideIndices` 过滤，默认跳过隐藏页，除非设置 `includeHidden`，每个输出页返回一个 SVG 字符串。过滤**只在 exportAll 中生效**，`exportSlide` 始终渲染传入的页。

## `SvgExportOptions` {#svgexportoptions}

| 字段                | 类型       | 默认值    | 用途                                                   |
| ------------------- | ---------- | --------- | ------------------------------------------------------ |
| `includeHidden`     | `boolean`  | `false`   | 批量导出时包含隐藏页。                                 |
| `slideIndices`      | `number[]` | -         | 从 0 开始的索引，仅对 `exportAll` 有效，省略表示全部。 |
| `defaultFontFamily` | `string`   | `'Arial'` | 元素未指定字体时的回退字体。                           |
| `defaultFontSize`   | `number`   | `18`      | 元素未指定字号时的回退值，单位为磅。                   |

## 渲染内容 {#what-gets-rendered}

模型中的每类元素都有对应处理，特殊内容不会导致异常：

| 元素                                             | 渲染方式                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `text`、`shape`                                  | 通过预设几何绘制填充、边框，再布局文本段。                           |
| `connector`                                      | 路径和箭头 `<marker>`，在 `<defs>` 中按颜色去重标记。                |
| `image`、`picture`                               | `<image>` 元素，PowerPoint 图片效果转换为 SVG `<filter>`。           |
| `table`                                          | 矩形网格和文本段。                                                   |
| `group`                                          | 在带变换的 `<g>` 中递归渲染子元素。                                  |
| `ink`                                            | 墨迹笔画路径。                                                       |
| `chart`                                          | 完整内联图表，数据不完整时回退到带名称的占位符。                     |
| `smartArt`                                       | SmartArt 形状，必要时回退到占位符。                                  |
| `ole`、`media`、`model3d`、`contentPart`、`zoom` | 预览图片，必要时回退到占位符。                                       |
| `unknown`                                        | 带名称的占位框。                                                     |
| 幻灯片背景                                       | 纯色矩形，或使用 `preserveAspectRatio="xMidYMid slice"` 的背景图片。 |

跳过 `el.hidden` 元素，在外层 `<g>` 上应用不透明度、翻转和旋转。渐变填充目前尽力降级为第一个色标的颜色。

## 导出全部幻灯片 {#export-all-slides}

```ts
import { PptxHandler, SvgExporter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const svgs = SvgExporter.exportAll(data, { includeHidden: false });
console.log(`${svgs.length} slides exported`); // string[]
```

## 导出单页 {#export-a-single-slide}

```ts
const svg = SvgExporter.exportSlide(data.slides[0], data.width, data.height, {
	defaultFontFamily: 'Inter',
});
```

## 写入磁盘（Node / Bun） {#write-svg-files-to-disk-node-bun}

::: code-group

```ts [Node fs]
import { PptxHandler, SvgExporter } from 'pptx-viewer-core';
import { readFile, writeFile } from 'node:fs/promises';

const file = await readFile('deck.pptx');
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

const handler = new PptxHandler();
const data = await handler.load(buffer as ArrayBuffer);

const svgs = SvgExporter.exportAll(data);
await Promise.all(svgs.map((svg, i) => writeFile(`slide_${i + 1}.svg`, svg, 'utf8')));
```

```ts [Bun]
import { PptxHandler, SvgExporter } from 'pptx-viewer-core';

const buffer = await Bun.file('deck.pptx').arrayBuffer();

const handler = new PptxHandler();
const data = await handler.load(buffer);

const svgs = SvgExporter.exportAll(data);
await Promise.all(svgs.map((svg, i) => Bun.write(`slide_${i + 1}.svg`, svg)));
```

```ts [From raw bytes (no handler juggling)]
// The CLI command handler wraps load + export in one call:
import { handleExportSvg } from 'pptx-viewer-core/cli';

const { slideCount, svgs } = await handleExportSvg(bytes, {
	includeHidden: true,
	slideIndices: [0, 2],
});
```

:::

::: info 在浏览器中使用
SVG 是字符串，可以插入 DOM（`el.innerHTML = svg`）、包装为 `image/svg+xml` 类型的 `Blob` 下载，或转换为 data URL。嵌入图片引用加载流程生成的 data URL，因此输出是自包含的。
:::

## 相关内容 {#see-also}

- [CLI](/zh/core/cli) 的 `export-svg` 封装 `SvgExporter.exportAll`，可用 `pptx export-svg deck.pptx ./out` 一次导出文件。
- [几何引擎](/zh/core/geometry)提供形状轮廓所需的预设路径计算。
