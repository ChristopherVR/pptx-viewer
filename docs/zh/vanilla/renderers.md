---
title: 原生 JavaScript 元素渲染器
description: 通过元素渲染器注册表扩展无需框架的 PowerPoint 查看器，按幻灯片元素类型覆盖或添加渲染器，无需 fork。
---

# 元素渲染器 {#element-renderers}

幻灯片上的每个元素都会根据其 `type`，即 `pptx-viewer-core` 中 `PptxElement` 的可辨识联合，通过**元素渲染器注册表**分发渲染。注册表是开放的扩展接口，宿主可以覆盖内置渲染器，或为查看器尚未渲染的类型添加渲染器，无需 fork 组件包。

## 渲染分层 {#how-rendering-is-layered}

幻灯片渲染采用自上而下的固定流程：

1. **舞台**（`renderSlideStage`）：创建 `div.pptxv-stage`，尺寸等于未缩放的幻灯片画布（以 CSS 像素表示的 `canvasSize.width x canvasSize.height`），应用解析后的幻灯片背景，通过 CSS `transform: scale(...)` 和 `transform-origin: top left` 缩放。因此，渲染器始终以**未缩放的画布像素**布局，不自行缩放。
2. **分发**：每个 `slide.elements[i]` 通过注册表解析（`registry.resolve(element.type)`），调用时传入 `zIndex = i`，文档顺序即层叠顺序。渲染器返回 `HTMLElement`、`SVGElement` 或 `null`，后者表示不渲染。
3. **舞台边界修饰**：交互画布上会为每个已渲染元素标记 `data-pptx-element="true"`，应用共享的无障碍元数据（`role`、`aria-label`、`aria-roledescription`），并在未启用模板编辑时锁定继承的模板元素（`pointer-events: none`）。缩略图栏不做这些处理。由于处理发生在舞台边界，宿主自定义渲染器也会自动获得这些能力。
4. **递归**：`group` 渲染器通过 `context.renderElement` 渲染子元素，因此覆盖也对组合内部生效。

相同流程用于渲染编辑器画布、缩略图栏、放映舞台和屏幕外的导出捕获舞台，它们只在传入的上下文标记上不同，包括 `scale`、`interactive` 和 `presenting`。

## 内置覆盖范围 {#built-in-coverage}

每种元素类型都有专用渲染器，只有未知扩展类型会使用占位符回退：

| 元素               | 渲染器模块，位于 `render/elements/`            |
| ------------------ | ---------------------------------------------- |
| `text`, `shape`    | `text-shape.ts`，加上 `text-block.ts` 辅助函数 |
| `image`, `picture` | `image.ts`                                     |
| `group`            | `group.ts`，通过 `context.renderElement` 递归  |
| `connector`        | `connector.ts`                                 |
| `table`            | `table.ts`                                     |
| `chart`            | `chart.ts` + `chart-svg.ts`                    |
| `smartArt`         | `smartart.ts`，以及 SVG、回退和三维变体        |
| `media`            | `media.ts`                                     |
| `ink`              | `ink.ts`                                       |
| `ole`              | `ole.ts`                                       |
| `model3d`          | `model3d.ts`                                   |
| `zoom`             | `zoom.ts`                                      |
| `contentPart`      | `contentpart.ts`                               |
| _其他任意类型_     | `placeholder.ts`，回退渲染器                   |

回退渲染器在元素应处的位置渲染带类型的占位框，显示元素类型，并带有 `data-element-id` 和 `data-element-type` 属性。

上下文包含可选渲染器标记：`smartArt3D`，以及 `surfaceChart3D`、`barChart3D`、`lineChart3D`、`areaChart3D` 和 `pieChart3D`，它们对应交互式 Three.js 变体，参见 [`PptxViewerOptions`](/zh/vanilla/options)。`presenting` 也会自动经由上下文传递，用于媒体自动播放和缩放定位磁贴导航。

## 渲染器约定 {#the-renderer-contract}

```ts
import { applyStyleMap, type ElementRenderer } from 'pptx-vanilla-viewer';

const myRenderer: ElementRenderer = (element, zIndex, context) => {
	const el = context.document.createElement('div');
	applyStyleMap(el, {
		position: 'absolute',
		left: `${element.x}px`,
		top: `${element.y}px`,
		width: `${element.width}px`,
		height: `${element.height}px`,
		zIndex: String(zIndex),
	});
	el.dataset.elementId = element.id;
	// ...build the element's content...
	return el; // HTMLElement | SVGElement | null (null renders nothing)
};
```

约定记录在源码的 `ElementRenderer` 上：

- 根据元素的 `x` / `y` / `width` / `height` 在舞台中**绝对定位**，使用未缩放的画布像素。内置渲染器通过共享 `getContainerStyle` 辅助函数完成，它也处理旋转和翻转。舞台通过 CSS transform 缩放，渲染器不要自行缩放。
- 在根节点上设置 `dataset.elementId = element.id`。
- **所有** DOM 都通过 `context.document` 创建，不使用全局 `document`，以便在测试和导出流程等场景中将幻灯片渲染到分离的文档。
- 不得修改 `element` 或上下文上的任何内容。

### `ElementRenderContext` {#elementrendercontext}

每次渲染器调用都接收不可变上下文：

| 字段                                                                           | 说明                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `document`                                                                     | 用于创建全部 DOM 的文档。                                     |
| `slide`                                                                        | 正在渲染的幻灯片。                                            |
| `slides?`, `currentSlideIndex?`                                                | 完整文稿和当前索引，供缩放定位元素解析目标预览。              |
| `canvasSize`                                                                   | 以 CSS 像素表示的完整幻灯片画布尺寸，元素在此坐标空间中定位。 |
| `scale`                                                                        | 舞台渲染比例，1 表示 100%；用于参考，例如决定栅格密度。       |
| `mediaDataUrls`                                                                | 媒体和封面帧的归档路径到可显示 URL 的映射。                   |
| `colorScheme?`                                                                 | 演示文稿主题配色方案，供支持主题的渲染辅助函数使用。          |
| `tableStyleMap?`                                                               | 解析后的 `ppt/tableStyles.xml` 定义，用于表格条带和表头样式。 |
| `fieldContext?`                                                                | 字段替换上下文，例如幻灯片编号和日期字段。                    |
| `t`                                                                            | 共享字典翻译函数，使用 `pptx.*` 键。                          |
| `smartArt3D`                                                                   | 可选 WebGL SmartArt 标记，与查看器选项一致。                  |
| `surfaceChart3D` / `barChart3D` / `lineChart3D` / `areaChart3D` / `pieChart3D` | 可选 WebGL 图表标记，分别与对应查看器选项一致。               |
| `presenting`                                                                   | 仅在当前放映舞台上为 true，用于媒体自动播放和缩放定位导航。   |
| `onZoomClick?`                                                                 | 仅放映时使用的缩放定位磁贴激活回调。                          |
| `onSmartArtNodeTextChange?` / `...FillChange?`                                 | 内联 SmartArt 编辑回调。                                      |
| `registry`                                                                     | 当前使用的注册表，供需要检查它的渲染器访问。                  |
| `renderElement(element, zIndex)`                                               | 通过注册表渲染子元素，是组合渲染器的递归入口。                |

## 注册表 API {#the-registry-api}

```ts
interface ElementRendererRegistry {
	register(type: PptxElementType, renderer: ElementRenderer): void; // add or replace
	unregister(type: PptxElementType): void; // falls back afterwards
	get(type: PptxElementType): ElementRenderer | undefined;
	has(type: PptxElementType): boolean; // dedicated (non-fallback) renderer?
	setFallback(renderer: ElementRenderer): void; // replace the placeholder fallback
	resolve(type: PptxElementType): ElementRenderer; // registered renderer or fallback
	registeredTypes(): PptxElementType[]; // sorted, for tests/debugging
}
```

`PptxElementType` 是 `PptxElement` 的 `type` 判别字段联合，例如 `'text'`、`'chart'`。

## 注册 {#registering}

创建实例后，为该实例注册：

```ts
const viewer = createPptxViewer(host, { source });
viewer.getRegistry().register('model3d', myModel3dRenderer);
```

也可以提前构建注册表并传入：

::: code-group

```ts [Override a built-in]
import { createDefaultRegistry, createPptxViewer } from 'pptx-vanilla-viewer';

const registry = createDefaultRegistry();
registry.register('table', myTableRenderer); // overrides the built-in
const viewer = createPptxViewer(host, { source, registry });
```

```ts [Start from empty]
import { createElementRendererRegistry, createPptxViewer } from 'pptx-vanilla-viewer';

// Empty registry: no built-ins, fallback renders nothing until you set one.
const registry = createElementRendererRegistry();
registry.register('text', myTextRenderer);
registry.setFallback(myPlaceholder);
const viewer = createPptxViewer(host, { source, registry });
```

:::

## 相关公开导出 {#related-public-exports}

以下包根入口导出支持自定义渲染器和无界面渲染：

| 导出项                                   | 说明                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `createDefaultRegistry()`                | 包含全部内置渲染器和占位符回退的注册表。                                    |
| `createElementRendererRegistry()`        | 空注册表，回退时不渲染任何内容。                                            |
| `renderSlideStage(options)`              | 将单张幻灯片渲染到分离的舞台元素（`SlideStageOptions`），是无界面渲染入口。 |
| `applyStyleMap(el, style)`               | 将共享 `CssStyleMap` 应用到元素，键可使用 camelCase 或 kebab-case。         |
| `createEl(doc, tag, className?, style?)` | 通过显式 `Document` 创建元素，可选传入类名和样式映射。                      |
| `createSvgEl(doc, tag, attrs?)`          | 创建带命名空间的 SVG 元素，可选传入属性。                                   |

`renderSlideStage` 返回的节点按未缩放画布尺寸布局，并通过 CSS transform 在屏幕上缩放，因此应将其包在尺寸为 `canvasSize * scale` 的容器中。查看器的舞台宿主和缩略图都采用这种方式。

## 注意事项 {#notes}

- 导航、缩放、主题和语言变化会自动重新渲染；注册表变化从下次渲染开始生效，可以切换幻灯片，或调用 `goToSlide(getCurrentSlide())` 强制渲染。
- 请复用 `pptx-viewer-shared` 辅助函数，不要重复实现几何和样式计算。[`packages/vanilla/src/viewer/render/elements/`](https://github.com/ChristopherVR/pptx-viewer/tree/main/packages/vanilla/src/viewer/render/elements) 中的内置渲染器可作为参考，其 `README.md` 记录了项目约定。
