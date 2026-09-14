---
title: 构建器 API
description: 使用 pptx-viewer-core 的链式 Presentation、SlideBuilder 和元素构建器 API，从零创建 PowerPoint 演示文稿。
---

# 构建器 API {#the-builder-api}

`pptx-viewer-core` 提供链式 SDK，可通过代码构建演示文稿，无需模板文件。按抽象层次从高到低分为三层：

1. **`Presentation`** / **`PptxHandler.create`**：管理幻灯片、文本、节、合并和保存，省去样板代码。
2. **元素构建器**：`TextBuilder`、`ShapeBuilder`、`ImageBuilder`、`TableBuilder`、`ChartBuilder`、`ConnectorBuilder`、`MediaBuilder`、`GroupBuilder`。
3. **`PptxXmlBuilder`**：直接修改 `PptxData` 的底层接口（参见[编程编辑](/zh/core/editing)）。

## 创建演示文稿 {#creating-a-presentation}

以下两个等效入口都会返回 `{ handler, data, createSlide }`：

```ts
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Sales Report',
	creator: 'Sales Team',
	initialSlideCount: 0,
});
```

`PptxHandler.create(options)` 是 `PptxHandler.createBlank(options)` 的别名。`createSlide(layoutName?)` 返回 `SlideBuilder`；调用 `.build()` 得到 `PptxSlide`，然后将其加入 `data.slides`。

### `create` 选项 {#create-options}

```ts
interface PresentationOptions {
	width?: number; // EMU, default 12192000 (16:9)
	height?: number; // EMU, default 6858000  (16:9)
	theme?: PresentationThemeInput;
	title?: string; // docProps/core.xml
	creator?: string; // author
	initialSlideCount?: number; // blank "Blank"-layout slides, default 0
}
```

使用 `SlideSizes`、`ThemePresets` 常量和单位辅助函数，可以更方便地指定数值：

```ts
import { SlideSizes, ThemePresets, inchesToEmu } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	width: SlideSizes.WIDESCREEN_16_9.width,
	height: SlideSizes.WIDESCREEN_16_9.height,
	theme: { name: 'Brand', colors: { accent1: '#2563EB' } },
});
```

`SlideSizes` 包含七个以 EMU 表示的尺寸：`WIDESCREEN_16_9`、`WIDESCREEN_16_10`、`STANDARD_4_3`、`A4_LANDSCAPE`、`A4_PORTRAIT`、`LETTER_LANDSCAPE` 和 `LETTER_PORTRAIT`。`theme.colors` 对象接受 OOXML 配色槽位（`dk1`、`lt1`、`dk2`、`lt2`、`accent1` 至 `accent6` 等），`theme.fonts` 接受 `majorFont` / `minorFont`。

::: tip 高层 `Presentation` 类
`Presentation` 类封装了同一个引擎，自动跟踪幻灯片（`Presentation.create(options)` / `Presentation.load(buffer)`），并提供 `replaceText`、`merge`、`diff`、节、模板、`applyTemplate`、`mailMerge`、`save()` 和 `saveEncrypted()`。不需要直接访问 `handler` / `data` 时，建议以它作为顶层入口。
:::

## 使用 `SlideBuilder` 构建幻灯片 {#building-a-slide-with-slidebuilder}

`createSlide(layoutName?)`（或 `Presentation.addSlide(layoutName?)`）返回支持链式调用的 `SlideBuilder`。每个 `add*` 调用都会返回构建器，因此可以连续调用：

```ts
const slide = createSlide('Blank')
	.addText('Q4 2026 Results', { fontSize: 44, bold: true, x: 100, y: 200, width: 800, height: 80 })
	.addShape('roundRect', {
		fill: { type: 'solid', color: '#2563EB' },
		text: 'See appendix',
		x: 700,
		y: 450,
		width: 200,
		height: 40,
	})
	.addImage('data:image/png;base64,iVBOR...', { x: 50, y: 50, width: 200, height: 100 })
	.addTable(
		{ rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }] },
		{ x: 50, y: 150, width: 400, height: 120 },
	)
	.addChart(
		'bar',
		{
			series: [{ name: '2026', values: [140, 170, 195, 210], color: '#2563EB' }],
			categories: ['Q1', 'Q2', 'Q3', 'Q4'],
			title: 'Revenue ($M)',
		},
		{ x: 50, y: 300, width: 600, height: 240 },
	)
	.setBackground({ type: 'solid', color: '#1B2A4A' })
	.setNotes('Open with the revenue highlight')
	.setTransition({ type: 'fade', duration: 500 })
	.build();

data.slides.push(slide);
```

### `SlideBuilder` 方法 {#slidebuilder-methods}

| 分组           | 方法                                                                                                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **添加元素**   | `addText(text, options)`、`addShape(preset, options)`、`addImage(src, options)`、`addTable(data, options?)`、`addChart(type, data, options?)`、`addConnector(options)`、`addMedia(kind, src, options)`、`addGroup(children, options)`、`addFreeform(svgPath, options)`、`addElement(element)`、`addBuilderElement(builder)` |
| **幻灯片属性** | `setBackground(fill)`、`setTransition(transition)`、`addAnimation(elementId, options)`、`setNotes(text)`、`setHidden(bool)`、`setSection(name)`、`setName(name)`                                                                                                                                                            |
| **查询与完成** | `getElements()`、`getLastElement()`、`elementCount`、`removeElement(id)`、`build()`                                                                                                                                                                                                                                         |

`add*` 选项中的位置以**像素**为单位（内部转换为 EMU）。`addText` 选项包括 `fontSize`、`fontFamily`、`bold`、`italic`、`underline`、`color`、`x`、`y`、`width`、`height` 等。

## 元素构建器 {#element-builders}

如需分步构建，八种元素构建器都提供静态 `.create(...)` 方法，以及生成标准 `PptxElement` 的 `.build()` 方法。可以将构建器直接传给 `addBuilderElement`，也可以自行调用 `.build()`。

```ts
import { TextBuilder, ShapeBuilder, ChartBuilder, TableBuilder } from 'pptx-viewer-core';

// Text - rich, chainable styling
const title = TextBuilder.create('Hello World')
	.fontSize(36)
	.bold()
	.color('#2563EB')
	.fontFamily('Inter')
	.alignment('center')
	.position(100, 100)
	.size(600, 80)
	.build();

// Shape - fill/stroke/shadow convenience methods + geometry adjustments
const button = ShapeBuilder.create('roundRect')
	.solidFill('#4472C4')
	.stroke({ color: '#000', width: 2 })
	.text('Click me')
	.adjustments({ adj1: 16667 })
	.position(200, 200)
	.size(300, 200)
	.build();

// Chart - bar | line | pie | doughnut | area | scatter | ...
const chart = ChartBuilder.create('bar')
	.categories(['North', 'South', 'East', 'West'])
	.addSeries('2026', [210, 150, 180, 120], '#2563EB')
	.title('Revenue ($M)')
	.legend(true, 'b')
	.grouping('clustered')
	.bounds(50, 100, 860, 420)
	.build();

// Table - header row, data rows, banding, proportional widths
const table = TableBuilder.create()
	.headerRow(['Name', 'Q1', 'Q2'])
	.addRow(['North', '120', '145'])
	.columnWidths([2, 1, 1])
	.bandRows()
	.position(50, 150)
	.size(860, 250)
	.build();
```

其余构建器遵循相同模式：`ImageBuilder.create(src)`、`ConnectorBuilder.create()`、`MediaBuilder.video(src)` / `MediaBuilder.audio(src)`，以及 `GroupBuilder.create()`（支持 `addChild`、`addChildBuilder` 和 `addChildren`）。

## 保存 {#saving}

将幻灯片放入 `data.slides` 后，使用创建它们的处理器进行序列化：

```ts
const bytes = await handler.save(data.slides); // Uint8Array
```

写入磁盘或触发浏览器下载，请参见[保存与往返处理](/zh/core/saving)；修改已加载的演示文稿，请参见[编程编辑](/zh/core/editing)。

## 单位辅助函数与主题预设 {#unit-helpers-and-theme-presets}

```ts
import { inches, cm, mm, pt, inchesToEmu, SlideSizes, ThemePresets } from 'pptx-viewer-core';

inches(1); // => 96 (pixels at 96 DPI)
inchesToEmu(10); // => 9144000 (EMU, for width/height options)
ThemePresets.MODERN_BLUE; // one of 8 built-in presets
```

`ThemePresets` 提供 `OFFICE`、`MODERN_BLUE`、`CORPORATE`、`DARK`、`VIBRANT`、`EARTH`、`MONOCHROME` 和 `MINIMAL`。
