---
title: 快速上手
description: 将 pptx-vanilla-viewer 挂载到容器，从 URL 或文件输入加载 .pptx，切换幻灯片并进入放映模式，无需前端框架。
---

# 快速接入 {#getting-started}

本页从空的 `<div>` 开始，逐步实现文件加载、导航和放映模式，得到可用的查看器。

::: tip 前置条件
请先安装组件包，参见[概览 > 安装](/zh/vanilla/#installation)。
:::

## 1. 挂载查看器 {#_1-mount-a-viewer}

`createPptxViewer(container, options)` 在 `container` 内构建查看器界面，并返回 [`PptxViewerInstance`](/zh/vanilla/api)。查看器会填满容器，因此请为容器设置明确的尺寸。

```html
<div id="host" style="height: 100vh"></div>
```

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/presentation.pptx',
	onLoad: ({ slideCount, canvasSize }) => {
		console.log(`${slideCount} slides at ${canvasSize.width}x${canvasSize.height}`);
	},
	onError: (message) => console.error(message),
});
```

`source` 接受 **URL 字符串**（自动获取）、**`ArrayBuffer`**、**`Uint8Array`** 或 **`Blob` / `File`**。省略时以空状态启动，稍后再加载。

## 2. 从文件 `<input>` 加载 {#_2-loading-from-a-file-input}

```html
<input type="file" id="file" accept=".pptx,.ppt" />
<div id="host" style="height: 80vh"></div>
```

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	onSlideChange: (index) => console.log('slide', index + 1),
});

document.getElementById('file')!.addEventListener('change', async (e) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		await viewer.loadFile(file); // Blob | ArrayBuffer | Uint8Array
	}
});
```

`loadFile` 和 `loadUrl` 替换当前演示文稿；每次成功加载都会再次触发 `onLoad` 回调。

## 3. 导航、缩放与放映 {#_3-navigation-zoom-and-presentation}

所有工具栏操作都有对应的实例方法：

```ts
viewer.next();
viewer.prev();
viewer.goToSlide(3); // zero-based, clamped

viewer.setZoom(1.5); // explicit scale (1 = 100%)
viewer.zoomToFit(); // fit-to-viewport
viewer.zoomIn();
viewer.zoomOut();
viewer.zoomToFit();

await viewer.enterPresentation(); // real Fullscreen API; Esc exits
await viewer.exitPresentation();
```

完整方法参考请参见[查看器实例 API](/zh/vanilla/api)。如果希望隐藏内置界面并自行驱动所有操作，请查看[选项与回调](/zh/vanilla/options)中的 `showToolbar` / `showThumbnails`。

## 键盘支持 {#keyboard-support}

查看器根元素可以获得焦点（`tabindex="0"`）。焦点位于查看器上时：

| 键数量                          | 操作                 |
| ------------------------------- | -------------------- |
| 方向键、PageUp / PageDown、空格 | 上一张或下一张幻灯片 |
| Home / End                      | 第一页 / 最后一页    |
| Esc                             | 退出放映模式         |

## 样式与所需 CSS {#styling-required-css}

无需导入 CSS。创建第一个查看器时，样式表会作为 `<style id="pptx-vanilla-viewer-styles">` 标签注入，每个文档只注入一次，作用域限定在 `.pptxv` 根类下。创建更多查看器时复用同一个标签。

### 严格 CSP 宿主：`getViewerCss` {#csp-strict-hosts-getviewercss}

如果内容安全策略禁止注入样式标签，请导入包中的静态样式表：

```ts
import 'pptx-vanilla-viewer/styles.css';
```

也可以自行渲染样式表文本。只要存在带有查看器样式 ID 的节点，就不会再自动注入：

```ts
import { getViewerCss } from 'pptx-vanilla-viewer';

// e.g. server-side, or in your build:
const style = document.createElement('style');
style.id = 'pptx-vanilla-viewer-styles';
style.textContent = getViewerCss();
document.head.appendChild(style);
```

所有界面颜色都来自 `--pptx-*` CSS 自定义属性，覆盖方式请参见[主题](/zh/vanilla/theming)。

## 本地化 {#localization}

界面字符串通过共享的 `pptx.*` 字典解析，内置英文。可以通过 `messages` 选项传入各语言的覆盖字典，并设置 `locale`，或稍后调用 `setLocale`。缺失的键先回退到英文，再回退到易读标签：

```ts
const viewer = createPptxViewer(host, {
	source,
	locale: 'de',
	messages: {
		de: { 'pptx.presenter.nextSlide': 'Nächste Folie' /* ... */ },
	},
});

viewer.setLocale('en'); // rebuilds the chrome labels
```

## 清理 {#cleanup}

移除查看器宿主时，请调用 `destroy()`，清理 DOM、事件监听器、Blob URL 和核心处理器：

```ts
viewer.destroy();
```

## 下一步 {#next-steps}

- [选项与回调](/zh/vanilla/options)：每个选项的详细说明。
- [查看器实例 API](/zh/vanilla/api)：完整实例方法参考。
- [元素渲染器](/zh/vanilla/renderers)：为更多元素类型扩展渲染。
