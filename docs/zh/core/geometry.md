---
title: 几何引擎
description: pptx-viewer-core 几何引擎概览，涵盖全部 187 种 ST_ShapeType 预设形状、裁剪路径、连接线路由、OOXML DrawingML 引导公式求值器和导出的辅助函数。
---

# 几何引擎 {#geometry-engine}

PowerPoint 形状并非以路径存储，而是由形状**预设**和调整控点定义，再通过 OOXML DrawingML 引导公式语言（ISO/IEC 29500-1 第 20.1.9 节）求值得到坐标。几何模块将这些内容转换为渲染器可用的 SVG 路径和裁剪路径。

本文介绍模块的职责及其公开辅助函数（由 `pptx-viewer-core` 重新导出）。各查看器绑定的形状渲染和无界面的 [SVG 导出](/zh/core/svg-export) 都由它提供支持。

## 预设表（数量已核实） {#preset-tables-verified-counts}

三个导出的表从不同角度覆盖 ECMA-376 预设目录：

`ST_ShapeType`（ISO/IEC 29500-1 第 20.1.10.56 节）是一个**包含 187 个值的封闭枚举**，其中每种预设都有完整、可求值的定义。衡量预设覆盖率时应以 187 为准；下面两个表的大小与此不同，只是因为它们包含额外的查找键。

| 表                            | 键数量 | 内容                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRESET_SHAPE_GEOMETRY_TABLE` | 194    | 完整的可求值几何定义（`avLst`、`gdLst`、`pathLst`、文本矩形）。包含全部 187 种 `ST_ShapeType` 预设、6 个别名键（`cylinder`、`pentArrow`、`flowChartStoredData`、`bentArrowCallout`、`bentUpArrowCallout`、`diamondTabs`），以及仅用于渲染的自定义形状 `mathFunction`。后者没有对应的 ECMA 形状，保存时降级为 `rect`。 |
| `PRESET_SHAPE_CLIP_PATHS`     | 200    | 按预设名称索引的预计算静态 SVG 裁剪路径（包含别名）。                                                                                                                                                                                                                                                                 |
| `PRESET_SHAPE_DEFINITIONS`    | 187    | 带显示名称的可插入形状定义，由 `PRESET_SHAPE_CATEGORY_LABELS` 分为 9 类：基本形状、矩形、箭头、星形、标注、流程图、数学符号、动作按钮和其他。                                                                                                                                                                         |

## 支持的能力 {#what-it-handles}

| 领域               | 说明                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **预设形状**       | 全部 187 种 `ST_ShapeType` 预设都支持求值和调整控点，包括矩形、箭头、星形、标注、流程图、动作按钮、卷轴、括号等。 |
| **裁剪路径**       | 每种预设都有预计算的 SVG 裁剪路径，也支持根据调整值生成路径。                                                     |
| **引导公式**       | 完整的 OOXML DrawingML 公式求值器（运算符见下文），支持内置变量和调整控点（`adj`、`adj1` 等）。                   |
| **自定义几何**     | 解析和求值任意 `<a:custGeom>` 路径（`parseStructuredCustomGeometry`、`evaluateGeometryPaths`）。                  |
| **连接线**         | 直线、折线和曲线连接线的路由与路径生成。                                                                          |
| **变换**           | 将元素位置、旋转和翻转转换为 CSS transform 字符串。                                                               |
| **布尔运算**       | 形状的并集、交集、相减和拆分，用于合并几何图形。                                                                  |
| **自由曲线与标注** | 自由曲线路径构建、Douglas-Peucker 简化、Catmull-Rom 平滑、标注引线几何和云形贝塞尔路径。                          |

## 解析形状的几何信息 {#resolving-geometry-for-a-shape}

最高层的用法是：根据元素边界框和调整值求值其预设，取得 SVG 路径数据和文本矩形。以下签名已对照 `packages/core/src/core/geometry/` 验证：

```ts
import { evaluatePresetShape, getAdjustmentAwareShapeClipPath } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

function resolveShapeGeometry(el: PptxElement) {
	if (el.type !== 'shape') return;

	// Full path geometry: SVG path data in pixel space + the text inset rect.
	const result = evaluatePresetShape(
		el.shapeType ?? 'rect', // preset name, e.g. 'roundRect', 'star5'
		el.width,
		el.height,
		el.shapeAdjustments, // optional Record<string, number> of adj overrides
	);
	// result: { svgPath: string; textRect?: { l: number; t: number; r: number; b: number } } | undefined

	// Or just a CSS/SVG clip-path value honouring the adjustment handles:
	const clip = getAdjustmentAwareShapeClipPath(
		el.shapeType,
		el.width,
		el.height,
		el.shapeAdjustments,
	);

	return { path: result?.svgPath, clip };
}
```

### 裁剪路径辅助函数 {#clip-path-helpers}

```ts
import {
	getShapeType, // normalize a raw preset name to a supported type ('rect' fallback)
	getShapeClipPath, // (shapeType: string | undefined) => static preset clip path
	getAdjustmentAwareShapeClipPath, // (shapeType, width, height, adjustments?) => adjusted clip path
	getShapeClipPathFromPreset, // (shapeType, width, height, adjustments?) => evaluated from the geometry table
	getPresetShapeClipPath, // raw lookup in PRESET_SHAPE_CLIP_PATHS
} from 'pptx-viewer-core';
```

注意，这些函数接受的是**预设名称字符串**（`element.shapeType`），不是元素本身。它们返回用于遮罩渲染元素边界框的 CSS/SVG `clip-path` 值；未知预设返回 `undefined`。

## 引导公式求值器 {#the-guide-formula-evaluator}

预设和自定义几何坐标以有序的引导公式表示。求值器实现了 ISO/IEC 29500-1 第 20.1.9.11 节中的全部运算符（已对照 `guide-formula-eval.ts` 验证）：

| 运算符                   | 含义                                            |
| ------------------------ | ----------------------------------------------- |
| `val`                    | 字面值                                          |
| `abs`、`sqrt`            | 绝对值、平方根                                  |
| `+-`                     | `x + y - z`                                     |
| `*/`                     | `(x * y) / z`                                   |
| `+/`                     | `(x + y) / z`                                   |
| `?:`（`if`）             | `x > 0 ? y : z`                                 |
| `min`、`max`             | 最小值、最大值                                  |
| `mod`                    | `sqrt(x^2 + y^2 + z^2)`                         |
| `pin`                    | 将 `y` 限制在 `x` 和 `z` 之间                   |
| `sin`、`cos`、`tan`      | `x * fn(y)`，`y` 使用 OOXML 角度单位            |
| `atan`、`at2`（`atan2`） | 反三角函数，结果使用 OOXML 角度单位             |
| `cat2`、`sat2`           | `x * cos(atan2(z, y))` / `x * sin(atan2(z, y))` |

角度使用 OOXML 单位，即一度的六万分之一（`cd4` = 90 度 = 5,400,000）。

`createBuiltinVariables({ w, h })` 初始化的内置变量包括：`w`、`h`、`l`、`t`、`r`、`b`、`hc`、`vc`，宽高分数 `wd2` 至 `wd12` / `hd2` 至 `hd12`，短边和长边 `ss`、`ls`、`ssd2` 至 `ssd32`，以及角度常量 `cd2`、`cd4`、`cd8`、`3cd4`、`3cd8`、`5cd8`、`7cd8`。

```ts
import {
	parseGuideDefinitions, // (gdNodes) => GeometryGuide[] from parsed <a:gd> XML
	parseAdjustmentValues, // (gdNodes) => Map<string, number> from <a:avLst>
	createBuiltinVariables, // ({ w, h }) => Map<string, number>
	evaluateGuides, // (guides, { w, h }, adjustments?) => Map<string, number>
	evaluateGeometryPaths, // (pathNodes, variables, ensureArray) => { pathData, pathWidth, pathHeight } | null
	resolveCoordinate, // (value, variables) => number
	ooxmlArcToSvg, // convert an OOXML arcTo segment to an SVG arc
	lookupPresetShape, // (name) => PresetShapeGeometryDefinition | undefined (case-insensitive)
} from 'pptx-viewer-core';

const vars = evaluateGuides([{ name: 'half', formula: '*/ w 1 2' }], { w: 200, h: 100 });
vars.get('half'); // => 100
```

## 连接线 {#connectors}

```ts
import { getConnectorPathGeometry, getConnectorAdjustment } from 'pptx-viewer-core';
import type { ConnectorPathGeometry } from 'pptx-viewer-core';

const geom = getConnectorPathGeometry(connectorElement);
// => { pathData: 'M 0 0 L 100 100', startX, startY, endX, endY }
```

`getConnectorPathGeometry(element)` 根据元素边界框、翻转和调整值，为直线（`line`）、折线（`bentConnector2..5`）和曲线（`curvedConnector2..5`）连接线规划路径，返回 SVG 路径和端点坐标，后者可用于放置箭头。

## 变换 {#transforms}

```ts
import { getElementTransform, getTextCompensationTransform } from 'pptx-viewer-core';

const transform = getElementTransform(element);
// => CSS transform string combining scaleX(-1)/scaleY(-1)/rotate(...), or undefined
```

`getTextCompensationTransform` 返回逆变换，使翻转形状内部的文本保持正向。

## 布尔运算与自由曲线 {#boolean-operations-and-freeform}

合并形状和绘制自由曲线时可使用：

```ts
import {
	unionShapes,
	intersectShapes,
	subtractShapes,
	fragmentShapes,
	combineShapes,
	svgPathToPolygons,
	polygonsToSvgPath,
	FreeformPathBuilder,
	douglasPeucker,
	catmullRomToBezier,
} from 'pptx-viewer-core';
```

标注几何相关函数：

```ts
import {
	isCalloutShape,
	getCalloutTier,
	getCalloutLeaderLineGeometry,
	buildCalloutLeaderLineSvgPath,
} from 'pptx-viewer-core';
```

::: tip 渲染
使用查看器绑定时，通常不需要直接调用这些函数，渲染器已经集成了它们。构建自定义渲染器，或在查看器之外（例如服务端）生成几何图形时，可以使用这些接口。有关视觉输出，请参见 [SVG 导出](/zh/core/svg-export)和 [React 绑定](/zh/react/)。
:::
