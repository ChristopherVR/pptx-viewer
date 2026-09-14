---
title: 编程编辑
description: 通过类型守卫查找元素，修改 PptxData 的文本、样式、几何、元素和幻灯片，同时保留 rawXml 等往返保存字段。
---

# 编程编辑 {#editing-programmatically}

将文稿[加载](/zh/core/loading)为 `PptxData` 后，直接修改内存模型，再[保存](/zh/core/saving)。模型是普通对象图，没有事务层。修改 `data.slides` 后传给 `handler.save()` 即可。

::: tip 使用同一处理器
请在产生数据的处理器上保存，它持有媒体、母版和自定义部件等内存 ZIP 数据，保存流程需要复用这些内容。
:::

## 查找元素 {#finding-elements}

`slide.elements` 是 `PptxElement[]`，通过 `type` 区分 `'text'`、`'shape'`、`'image'`、`'picture'`、`'table'`、`'chart'`、`'connector'`、`'group'`、`'smartArt'`、`'media'`、`'ink'`、`'ole'` 等类型，完整列表见[数据模型](/zh/guide/data-model)。可直接判断辨识字段，或使用导出的类型守卫：

| 守卫                     | 缩小后的类型                                   |
| ------------------------ | ---------------------------------------------- |
| `isTextElement(el)`      | `TextPptxElement`                              |
| `isShapeElement(el)`     | `ShapePptxElement`                             |
| `isConnectorElement(el)` | `ConnectorPptxElement`                         |
| `isImageLikeElement(el)` | `PptxImageLikeElement`（`image` 或 `picture`） |
| `isInkElement(el)`       | `InkPptxElement`                               |
| `isZoomElement(el)`      | `ZoomPptxElement`                              |

组合元素 `type: 'group'` 将成员保存在 `children: PptxElement[]`，完整遍历需要递归：

```ts
import type { PptxElement } from 'pptx-viewer-core';

function* walkElements(elements: PptxElement[]): Generator<PptxElement> {
	for (const el of elements) {
		yield el;
		if (el.type === 'group') {
			yield* walkElements(el.children);
		}
	}
}

for (const slide of data.slides) {
	for (const el of walkElements(slide.elements)) {
		if (el.type === 'image') console.log(el.id, el.width, el.height);
	}
}
```

## 编辑文本 {#editing-text}

最简单的方式是修改文本、形状或连接线等可含文本元素的 `text`：

```ts
const data = await handler.load(buffer);

for (const slide of data.slides) {
	for (const el of slide.elements) {
		if (el.type === 'text' || el.type === 'shape') {
			if (el.text === 'DRAFT') el.text = 'FINAL';
		}
	}
}
```

富文本保存在 `textSegments: TextSegment[]`，每个 `{ text, style }` 表示一个带样式的文本段。保存流程会协调两者：修改 `el.text` 且现有文本段样式一致时，以纯文本为准；存在混合样式时，将修改后的文本重新映射到原有文本段样式，以保留格式。需要明确控制每段样式时，直接编辑 `textSegments`。

整份文稿的查找替换可使用 SDK 提供的纯函数：

```ts
import { findText, replaceText, replaceTextInSlide } from 'pptx-viewer-core';

// findText(slides: PptxSlide[], search: string | RegExp): FindResult[]
const matches = findText(data.slides, /Q[1-4]/g);
// Each FindResult: { slideIndex, elementId, segmentIndex, text, matchIndex }

// replaceText(slides, search, replacement): number of replacements made
const count = replaceText(data.slides, '2025', '2026');

// Scoped to one slide:
replaceTextInSlide(data.slides[0], 'Draft', 'Final');
```

两个搜索工具均递归访问组合子元素，并匹配文本段内容。

## 移动与调整尺寸 {#moving-and-resizing-elements}

每个元素通过 `PptxElementBase` 提供 `x`、`y`、`width`、`height`，以及可选的 `rotation`（度）、`flipHorizontal`、`flipVertical` 和 `opacity`（0-1）：

```ts
const el = data.slides[0].elements[0];
el.x += 100; // shift right
el.y = 50; // move to top
el.width = 400; // resize
el.rotation = 15; // degrees
el.opacity = 0.5;
```

::: info 单位
模型使用像素便于渲染，PowerPoint 原生使用 EMU，96 DPI 下 `1 px = 9,525 EMU`。保存时自动转回 EMU。包导出 `emuToPixels`、`pixelsToEmu`、`inchesToEmu`、`cmToEmu` 及 `EMU_PER_PIXEL`、`EMU_PER_INCH`、`EMU_PER_POINT`。
:::

## 设置样式 {#styling-elements}

形状、连接线和图片的填充、轮廓和效果位于 `shapeStyle: ShapeStyle`。文本格式位于 `textStyle: TextStyle`，逐段格式位于 `textSegments[i].style`：

```ts
if (el.type === 'shape') {
	el.shapeStyle = {
		...el.shapeStyle,
		fillColor: '#00AA55',
		strokeColor: '#333333',
		strokeWidth: 2,
	};
	el.textStyle = { ...el.textStyle, fontSize: 18, bold: true, color: '#ffffff' };
}
```

从主题求值的颜色会在辅助字段中保留原 XML，例如 `shapeStyle.fillColorXml` 保存带变换的 `a:schemeClr`。无需修改这些字段：保存时，只有颜色值仍匹配原节点才重新输出它；覆盖 `fillColor` 后，写入器改为使用对应值的规范 `<a:srgbClr>`。

## 添加与删除元素 {#adding-and-removing-elements}

`slide.elements` 是普通数组，可使用 push、splice 或 filter。新元素可通过链式[元素构建器](/zh/core/builder)（`TextBuilder`、`ShapeBuilder`、`ImageBuilder`、`TableBuilder`、`ChartBuilder`、`ConnectorBuilder`、`MediaBuilder`、`GroupBuilder`）或 `create*Element` 工厂函数创建：

```ts
import { TextBuilder, ShapeBuilder, duplicateElement } from 'pptx-viewer-core';

const slide = data.slides[0];

// Add
slide.elements.push(
	TextBuilder.create('Added at runtime').fontSize(24).position(50, 400).size(600, 40).build(),
);

// Remove by id
slide.elements = slide.elements.filter((e) => e.id !== 'el_to_delete');

// Duplicate (deep clone with fresh ids)
const copy = duplicateElement(slide.elements[0]);
copy.x += 20;
copy.y += 20;
slide.elements.push(copy);
```

按 ID 路由的链式修改可使用 `PptxXmlBuilder`：

```ts
import { PptxXmlBuilder, ShapeBuilder } from 'pptx-viewer-core';

PptxXmlBuilder.from(data)
	.slide(0)
	.elements()
	.add(ShapeBuilder.create('rect').solidFill('#EEE').size(100, 100).build())
	.removeById('old_id')
	.updateById('el_id', (el) => ({ ...el, x: 200 }))
	.done()
	.notes()
	.set('Updated notes')
	.done()
	.done()
	.project(); // => the same (mutated) PptxData
```

`slide(index)` 在索引越界时抛错。`add`、`removeById` 和 `updateById` 返回元素构建器以继续链式调用，`done()` 返回上一层。

## 添加与删除幻灯片 {#adding-and-removing-slides}

幻灯片也是普通数组。通过 `PptxHandler.create()` 或 `createBlank()` 得到处理器时，返回的 `createSlide` 工厂可构建新页：

```ts
const { handler, data, createSlide } = await PptxHandler.create({ title: 'Report' });

data.slides.splice(1, 0, createSlide('Blank').addText('Inserted').build());
data.slides.splice(3, 1); // remove slide 4
```

复制已加载的幻灯片时，使用纯函数 `duplicateSlide(slide, newSlideNumber)` 深克隆并重新分配标识：

```ts
import { duplicateSlide } from 'pptx-viewer-core';

data.slides.push(duplicateSlide(data.slides[0], data.slides.length + 1));
```

高层 `Presentation` 类提供 `addSlide`、`insertSlide`、`duplicateSlide(index)`（返回新页索引）、`removeSlide`、`moveSlide`、`swapSlides`、`reorderSlides` 和 `clearSlides`。删除和排序方法返回 `this`，支持链式调用：

```ts
import { Presentation } from 'pptx-viewer-core';

const pptx = await Presentation.load(buffer);
const copyIndex = pptx.duplicateSlide(0); // returns the new index, not `this`
pptx.moveSlide(copyIndex, 2).removeSlide(5);
const bytes = await pptx.save();
```

保存流程会协调新增、删除和重排，重建 `ppt/presentation.xml`、关系和内容类型。

## 处理表格 {#working-with-tables}

`type: 'table'` 元素的 `element.tableData` 包括 `rows`（每行有 `cells`）、总和为 1 的比例 `columnWidths`、条纹标记和 `tableStyleId`。单元格提供 `text`、可选的字体大小/粗体/颜色等 `style`，以及 `gridSpan`、`rowSpan`、`vMerge`、`hMerge` 合并字段，可原位修改：

```ts
for (const el of slide.elements) {
	if (el.type === 'table' && el.tableData) {
		el.tableData.rows[0].cells[0].text = 'Header';
		el.tableData.rows[0].cells[0].style = { bold: true };
	}
}
```

## 处理图表 {#working-with-charts}

`type: 'chart'` 元素的数据位于 `element.chartData`。SDK 提供原位修改数据的纯操作函数：

```ts
import {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartDataPoint,
	setChartTitle,
} from 'pptx-viewer-core';

if (el.type === 'chart') {
	setChartTitle(el, 'Quarterly Revenue');
	setChartCategories(el, ['Q1', 'Q2', 'Q3', 'Q4']);
	addChartSeries(el, { name: 'Revenue', values: [100, 150, 130, 170], color: '#4472C4' });
	updateChartDataPoint(el, 0, 2, 145); // series 0, point 2
}
```

也支持结构和格式设置：

| 操作                                                                                                       | 职责                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `setChartType`、`setChartGrouping`、`setChartSeriesChartType`                                              | 图表、系列类型和分组           |
| `setChartLegend`、`setChartDataLabels`                                                                     | 图例位置和数据标签             |
| `setChartAxis`、`setChartAxisLogScale`、`setChartAxisTitleStyle`、`setChartAxisGridlineStyle`              | 坐标轴范围、刻度、标题和网格线 |
| `setChartSeriesTrendline`、`setChartSeriesErrorBars`                                                       | 趋势线和误差线                 |
| `setChartSeriesColor`、`setChartSeriesMarker`                                                              | 系列外观                       |
| `setChartDataPointFill`、`setChartDataPointExplosion`、`setChartDataPointMarker`、`setChartDataPointLabel` | 单个数据点的覆盖设置           |

系列索引会经过校验，越界时抛出错误。

## rawXml 与往返保存字段 {#rawxml-and-round-trip-fields}

真实 `.pptx` 解析出的元素带有 `rawXml`，保存原始的 OOXML 节点，如 `p:sp`、`p:pic` 或 `p:graphicFrame`。保存时，写入器以它为基础，再应用类型化的变换、几何、样式和文本字段，保留模型未表示的属性和子节点。SDK 新建的元素没有 `rawXml`，会从头生成规范 XML。

更细粒度的保存也采用同样方式，例如 `shapeStyle.fillColorXml`、`fillGradientXml`、`fillPatternXml`、`textStyle.runPropertiesXml`、表格单元格 `tcPr`、动画和扩展列表等。

::: warning 将 rawXml 视为不透明数据
不要删除 `rawXml` 和 `*Xml` 辅助字段，否则会丢失本可保留的内容。除非有意编写 OOXML，也不要手动修改它们。受支持的编辑接口是类型化字段，两者重叠时类型化字段优先。
:::

## 常见用法 {#recipes}

### 批量查找替换 {#bulk-find-and-replace}

```ts
import { PptxHandler, replaceText } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);
replaceText(data.slides, /\b2025\b/g, '2026');
const bytes = await handler.save(data.slides);
```

### 应用主题预设 {#restyle-with-a-theme-preset}

`THEME_PRESETS` 包含 office、facet、integral、ion、organic、retrospect、slate 和 metropolitan 八种颜色/字体方案。`handler.switchThemePreset` 同时更新内存 ZIP 和模型中已求值的颜色，使修改可以保存：

```ts
import { THEME_PRESETS } from 'pptx-viewer-core';

const preset = THEME_PRESETS.find((p) => p.id === 'ion')!;
const rethemed = await handler.switchThemePreset(data, preset);
const bytes = await handler.save(rethemed.slides);
```

自定义方案可通过 `handler.applyTheme(colorScheme, fontScheme, themeName?)` 和纯函数 `applyThemeToData(data, colorScheme, fontScheme?, themeName?)` 分两步实现。

### 重排幻灯片 {#reorder-slides}

```ts
// In place on the array:
const [moved] = data.slides.splice(4, 1);
data.slides.splice(0, 0, moved);

// Or with the Presentation class:
pptx.reorderSlides([2, 0, 1, 3]); // new order by old index
```

### 为每页添加标记 {#stamp-every-slide}

```ts
import { TextBuilder } from 'pptx-viewer-core';

for (const slide of data.slides) {
	slide.elements.push(
		TextBuilder.create('Confidential')
			.fontSize(12)
			.color('#999999')
			.position(50, 520)
			.size(300, 20)
			.build(),
	);
}
```

每次 `build()` 都生成新的唯一 ID，因此可为各页重复构建同一链式配置。

## 完整的加载、修改和保存 {#complete-load-mutate-save}

```ts
import { PptxHandler, replaceText, TextBuilder } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

// 1. Find/replace across the deck
replaceText(data.slides, '2025', '2026');

// 2. Reposition the first element
const el = data.slides[0].elements[0];
el.x = 100;
el.y = 100;

// 3. Add a footer to slide 1
data.slides[0].elements.push(
	TextBuilder.create('Confidential')
		.fontSize(12)
		.color('#999')
		.position(50, 520)
		.size(300, 20)
		.build(),
);

// 4. Save
const bytes = await handler.save(data.slides); // Uint8Array
```

写入磁盘或浏览器的方法见[保存](/zh/core/saving)，从零创建文稿见[构建器](/zh/core/builder)。
