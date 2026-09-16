---
title: 查看器实例 API
description: createPptxViewer 返回的 PptxViewerInstance，涵盖加载、导航、缩放、模式、编辑、保存、导出与打印、幻灯片和元素数据 API、协作、自动保存、渲染器注册表、核心处理器入口及销毁。
---

# 查看器实例 API {#viewer-instance-api}

`createPptxViewer` 返回 `PptxViewerInstance`，它是其他绑定中模板 ref 或句柄的命令式对应接口。所有工具栏操作都有对应的实例方法，因此可以隐藏界面控件（`showToolbar: false`、`showThumbnails: false`），从自己的界面驱动查看器。该接口继承各绑定共同实现的 `PowerPointViewerAPI`，因此下面的 `getContent`、`goTo`、`getSlides` 等方法与 React、Vue、Angular 和 Svelte 句柄一致。

```ts
import { createPptxViewer, type PptxViewerInstance } from 'pptx-vanilla-viewer';

const viewer: PptxViewerInstance = createPptxViewer(host, { source });
```

## 加载 {#loading}

| 方法       | 签名                                                         | 说明                                            |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `loadFile` | `(file: Blob \| ArrayBuffer \| Uint8Array) => Promise<void>` | 从字节或 Blob/File 加载演示文稿，替换当前内容。 |
| `loadUrl`  | `(url: string) => Promise<void>`                             | 从 URL 获取并加载演示文稿。                     |

两者均在演示文稿渲染完成后解析 Promise，失败通过 `onError` 回调报告。

## 导航 {#navigation}

| 方法                                         | 签名                      | 说明                                                |
| -------------------------------------------- | ------------------------- | --------------------------------------------------- |
| `next` / `goNext`                            | `() => void`              | 转到下一张幻灯片，在最后一张时不执行操作。          |
| `prev` / `goPrev`                            | `() => void`              | 转到上一张幻灯片，在第一张时不执行操作。            |
| `goToSlide` / `goTo` / `setActiveSlideIndex` | `(index: number) => void` | 跳转到从 0 开始的幻灯片索引，自动限制在有效范围内。 |
| `getSlideCount`                              | `() => number`            | 已加载演示文稿中的幻灯片数量，未加载时为 0。        |
| `getCurrentSlide` / `getActiveSlideIndex`    | `() => number`            | 当前可见幻灯片的索引，从 0 开始。                   |

别名 `goTo`、`goPrev`、`goNext`、`getActiveSlideIndex`、`setActiveSlideIndex` 来自共享 `PowerPointViewerAPI`，与原生 JavaScript 绑定自身的方法名称行为相同。

## 缩放 {#zoom}

| 方法        | 签名                     | 说明                                        |
| ----------- | ------------------------ | ------------------------------------------- |
| `getZoom`   | `() => number`           | 计算适应比例后的实际缩放比例，1 表示 100%。 |
| `setZoom`   | `(zoom: number) => void` | 设置明确的缩放比例。                        |
| `zoomIn`    | `() => void`             | 放大一级。                                  |
| `zoomOut`   | `() => void`             | 缩小一级。                                  |
| `zoomToFit` | `() => void`             | 使幻灯片适应视口。                          |
| `zoomReset` | `() => void`             | 重置为 100%。                               |

## 查看器模式 {#viewer-mode}

| 方法      | 签名                         | 说明                       |
| --------- | ---------------------------- | -------------------------- |
| `getMode` | `() => ViewerMode`           | 从状态推导的当前模式。     |
| `setMode` | `(mode: ViewerMode) => void` | 切换模式，映射关系见下文。 |

```ts
type ViewerMode = 'preview' | 'edit' | 'present' | 'master';
```

`setMode('present')` 进入放映模式；`'edit'` 启用编辑；`'master'` 启用编辑并切换到母版视图；`'preview'` 退出放映或母版模式，并禁用编辑。

## 主题与本地化 {#theming--localization}

| 方法        | 签名                                        | 说明                                                                               |
| ----------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `setTheme`  | `(theme: ViewerTheme \| undefined) => void` | 应用新的查看器主题，传入 `undefined` 恢复默认值。参见[主题](/zh/vanilla/theming)。 |
| `setLocale` | `(locale: string) => void`                  | 切换界面语言，重新构建界面标签。                                                   |

## 放映模式 {#presentation-mode}

| 方法                | 签名                  | 说明                                   |
| ------------------- | --------------------- | -------------------------------------- |
| `enterPresentation` | `() => Promise<void>` | 通过真实 Fullscreen API 进入放映模式。 |
| `exitPresentation`  | `() => Promise<void>` | 退出放映模式，Esc 也可以退出。         |

进入和退出时会触发 `onPresentationChange` 回调。

## 编辑 {#editing}

在选项中传入 `editable: true`，或调用 `setEditable(true)`，即可直接在 DOM 中启用点击选择、拖动移动、缩放和旋转控点、双击内联文本编辑。以下方法是这些交互对应的编程入口：

| 方法                   | 签名                          | 说明                                           |
| ---------------------- | ----------------------------- | ---------------------------------------------- |
| `setEditable`          | `(editable: boolean) => void` | 运行时启用或禁用编辑，禁用时清空选区。         |
| `setEditTemplateMode`  | `(enabled: boolean) => void`  | 将当前幻灯片继承的母版和布局元素作为编辑目标。 |
| `undo`                 | `() => void`                  | 撤销上一次编辑，撤销栈为空时不执行操作。       |
| `redo`                 | `() => void`                  | 重做上一次撤销的编辑，重做栈为空时不执行操作。 |
| `canUndo` / `canRedo`  | `() => boolean`               | `undo()` / `redo()` 是否存在可执行操作。       |
| `deleteSelected`       | `() => void`                  | 删除选中元素，没有选区时不执行操作。           |
| `getSelectedElementId` | `() => string \| null`        | 选中元素的 ID，未选中时为 `null`。             |
| `isDirty`              | `() => boolean`               | 文档是否存在未保存修改。                       |

任何修改后都会触发 `onChange`，包括移动、缩放、旋转、文本编辑、删除、撤销和重做；未保存编辑标记变化时触发 `onDirtyChange`；选中元素 ID 变化时触发 `onSelectionChange`。

选中元素且启用编辑时，可使用以下快捷键：`Ctrl` / `Cmd+Z` 撤销，`Ctrl` / `Cmd+Shift+Z`（或 `Ctrl+Y`）重做，`Delete` / `Backspace` 删除，`Ctrl` / `Cmd+D` 复制，方向键微移 1 像素（`Shift` 加方向键移动 10 像素），`Escape` 取消选择。

## 保存与下载 {#saving-downloads}

| 方法                | 签名                                                           | 说明                                                                          |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `save`              | `(format?: PptxSaveFormat) => Promise<Uint8Array>`             | 序列化演示文稿，包括编辑后的内容，默认格式为 `'pptx'`，并清除未保存修改标记。 |
| `getContent`        | `() => Promise<Uint8Array>`                                    | `save()` 的别名，返回序列化的 `.pptx` 字节，是共享 API 中的名称。             |
| `downloadAs`        | `(format: PptxSaveFormat, fileName?: string) => Promise<void>` | 保存并以支持的 OpenXML 格式触发浏览器下载。                                   |
| `downloadPptx`      | `(fileName?: string) => Promise<void>`                         | 调用 `save()` 并触发浏览器下载，默认文件名为 `presentation.pptx`。            |
| `packageForSharing` | `(fileName?: string) => Promise<void>`                         | 将当前演示文稿和使用说明打包为可分享的 ZIP 并下载。                           |

```ts
type PptxSaveFormat = 'pptx' | 'ppsx' | 'pptm';
```

```ts
const viewer = createPptxViewer(host, { source, editable: true });

undoButton.addEventListener('click', () => viewer.undo());
redoButton.addEventListener('click', () => viewer.redo());
saveButton.addEventListener('click', () => void viewer.downloadPptx('edited.pptx'));
```

## 导出与打印 {#export--print}

栅格导出以比例 1 在屏幕外渲染每张幻灯片，再通过 `html2canvas-pro` 栅格化。该依赖动态导入，因此首次调用有一次性加载开销。`jspdf` 和 GIF 编码器也延迟加载。同一时间只运行一次导出，已有导出正在进行时，新的调用会直接完成而不执行操作。

| 方法               | 签名                                              | 说明                                                                                       |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `exportSlidePng`   | `(index?: number) => Promise<void>`               | 将幻灯片导出为 PNG 并下载，默认使用当前幻灯片。                                            |
| `copySlideAsImage` | `(index?: number) => Promise<void>`               | 将幻灯片作为 PNG 图片复制到系统剪贴板。                                                    |
| `exportPdf`        | `(options?: ExportPdfOptions) => Promise<void>`   | 将所有幻灯片导出为多页 PDF 并下载，每页一张幻灯片。                                        |
| `exportGif`        | `(options?: ExportGifOptions) => Promise<void>`   | 将所有幻灯片导出为动态 GIF 并下载，每张幻灯片一帧，使用共享的纯 JavaScript GIF89a 编码器。 |
| `exportVideo`      | `(options?: ExportVideoOptions) => Promise<void>` | 将所有幻灯片导出为 WebM 视频并下载，通过 `MediaRecorder` 录制画布流。                      |
| `print`            | `(options?: PrintOptions) => Promise<boolean>`    | 组装可打印文档并在打印窗口中打开，`false` 表示弹窗被拦截。                                 |

所有选项接口均从包根入口导出：

```ts
type ExportProgress = (current: number, total: number) => void;

interface ExportPdfOptions {
	onProgress?: ExportProgress; // capture-phase progress: (currentSlide, totalSlides)
	signal?: AbortSignal; // abort early; checked between slides
}

interface ExportGifOptions {
	slideDurationMs?: number; // per-frame duration, default 2000
	slideTimingsMs?: number[]; // per-slide overrides (e.g. rehearsed timings)
	maxDimension?: number; // cap on the longer frame side, default 1920
	onProgress?: ExportProgress;
	signal?: AbortSignal;
}

interface ExportVideoOptions {
	slideDurationMs?: number; // per-slide hold, default 3000
	slideTimingsMs?: number[]; // per-slide overrides
	fps?: number; // recording frame rate, default 30
	videoBitsPerSecond?: number; // MediaRecorder bitrate, default 5,000,000
	onProgress?: ExportProgress; // capture phase
	onRecordProgress?: ExportProgress; // recording phase
	signal?: AbortSignal;
}
```

下载文件名分别为 `presentation-slide-<n>.png`、`presentation.pdf`、`presentation.gif` 和 `presentation.webm`。通过 `signal` 中止时，Promise 会以名为 `AbortError` 的 `DOMException` 拒绝。

### `renderToCanvas` {#rendertocanvas}

从包根入口导出的独立函数，无需查看器实例，可将任意 DOM 元素栅格化到 Canvas：

```ts
import { renderToCanvas } from 'pptx-vanilla-viewer';

const canvas: HTMLCanvasElement = await renderToCanvas(element, { scale: 2 });
const dataUrl = canvas.toDataURL('image/png');
```

```ts
function renderToCanvas(
	element: HTMLElement,
	options?: Partial<Html2CanvasOptions>, // the html2canvas-pro Options type
): Promise<HTMLCanvasElement>;
```

这是 React、Vue、Angular 和 Svelte 绑定也导出的同一个 `html2canvas-pro` 包装函数。建议使用它，不要直接调用 `html2canvas`：它在 `onclone` 阶段执行共享 CSS 预处理，将现代颜色函数（`oklch` / `oklab` / `lch` / `lab` / `color()`）转换为 sRGB，并展平处理 `backdrop-filter`、`mix-blend-mode` 和 CSS 三维变换。查看器主题令牌使用 `oklch`，html2canvas 本身无法解析。

### 打印 {#print}

`print()` 通过共享打印模块组装幻灯片、备注页、讲义和大纲视图。`PrintOptions` 可以是共享 `PrintSettings` 的任意子集，未指定字段使用默认值：全部幻灯片、横向、全彩；另可提供进度、中止和窗口覆盖选项：

```ts
interface PrintOptions extends Partial<PrintSettings> {
	onProgress?: ExportProgress;
	signal?: AbortSignal;
	openPrintWindow?: (htmlDocument: string) => boolean; // OpenPrintWindow
}

interface PrintSettings {
	printWhat: 'slides' | 'handouts' | 'notes' | 'outline'; // default 'slides'
	orientation: 'portrait' | 'landscape'; // default 'landscape'
	colorMode: 'color' | 'grayscale' | 'blackAndWhite'; // default 'color'
	frameSlides: boolean; // default false
	slidesPerPage: 1 | 2 | 3 | 4 | 6 | 9; // handouts only, default 6
	slideRange: 'all' | 'current' | 'custom'; // default 'all'
	customRangeFrom: number; // 1-based, default 1
	customRangeTo: number; // 1-based, default 1
}
```

::: warning 弹窗拦截器
默认打开方式使用 `window.open`，浏览器通常只允许在用户操作内调用。请从点击处理器调用 `print()`，或传入自定义 `openPrintWindow`，写入你自己的 iframe。弹窗被拦截时，Promise 解析为 `false`。
:::

### SVG 导出（独立函数） {#svg-export-standalone-functions}

矢量导出无需查看器实例，两个纯函数直接处理解析后的核心数据，可以通过 `getHandler()` 或 `getSlides()` 取得：

```ts
import { exportSlideToSvg, exportAllSlidesToSvg } from 'pptx-vanilla-viewer';

exportSlideToSvg(slide, width, height, options?): string; // one slide as SVG markup
exportAllSlidesToSvg(data, options?): string[]; // PptxData in, one SVG string per slide

interface SvgExportOptions {
	includeHidden?: boolean; // include hidden slides when exporting all, default false
	slideIndices?: number[]; // 0-based subset; omitted = all slides
	defaultFontFamily?: string;
	defaultFontSize?: number; // points
}
```

## 幻灯片与元素（数据 API） {#slides-elements-data-api}

这是供宿主自行构建界面的共享数据接口。幻灯片 getter 返回实际的、带类型的 `PptxSlide[]` / `PptxElement[]` 模型只读快照；修改只能通过操作方法回写，这些方法会纳入撤销和重做，并触发 `onChange`。

| 方法                    | 签名                                                                                   | 说明                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `getSlides`             | `() => readonly PptxSlide[]`                                                           | 完整的幻灯片数组。                                                               |
| `getSlide`              | `(index: number) => PptxSlide \| undefined`                                            | 按从 0 开始的索引获取单张幻灯片。                                                |
| `getActiveSlide`        | `() => PptxSlide \| undefined`                                                         | 当前活动幻灯片。                                                                 |
| `addSlide`              | `(afterIndex?: number) => void`                                                        | 在给定索引之后添加空白幻灯片，默认添加到末尾。                                   |
| `deleteSlides`          | `(indexes: number[]) => void`                                                          | 删除给定索引的幻灯片，至少保留一张。                                             |
| `duplicateSlides`       | `(indexes: number[]) => void`                                                          | 复制给定索引的幻灯片。                                                           |
| `moveSlide`             | `(fromIndex: number, toIndex: number) => void`                                         | 将幻灯片移动到新位置。                                                           |
| `toggleHideSlides`      | `(indexes: number[]) => void`                                                          | 切换指定幻灯片的隐藏标记。                                                       |
| `getElements`           | `(slideIndex?: number) => readonly PptxElement[]`                                      | 某张幻灯片上的元素，默认使用当前幻灯片。                                         |
| `getElementById`        | `(elementId: string, slideIndex?: number) => PptxElement \| undefined`                 | 按 ID 获取单个元素。                                                             |
| `updateElement`         | `(elementId: string, updates: Partial<PptxElement>) => void`                           | 部分更新元素属性，例如 `{ x: 100, width: 300 }`。                                |
| `updateElements`        | `(updates: readonly ElementUpdate[], options?: ElementUpdateOptions) => Promise<void>` | [跨页批量更新元素，整批修改占用一个撤销步骤](/zh/guide/element-update-batches)。 |
| `deleteElements`        | `(elementIds: string[]) => void`                                                       | 按 ID 从当前幻灯片中删除元素。                                                   |
| `duplicateElement`      | `(elementId: string) => string \| undefined`                                           | 复制元素，返回新元素的 ID。                                                      |
| `getSelectedElementIds` | `() => string[]`                                                                       | 当前选中元素的 ID。                                                              |
| `selectElements`        | `(ids: string[]) => void`                                                              | 通过代码选择元素。                                                               |
| `clearSelection`        | `() => void`                                                                           | 清空选区。                                                                       |

## 插入元素 {#add-element}

`addElement(element: PptxElement): string | undefined` 将元素的防御性副本追加到当前可编辑幻灯片，选中它并返回新 ID。坐标保持不变，组合内的后代也会获得新 ID。未提交的文本通过已有编辑流程确认，正常更新未保存状态和撤销重做历史。同步编辑可能共用一条历史记录，但所有插入都会保留。加载期间、加载失败后、没有当前幻灯片时，以及只读、受保护、预览、放映、模板或母版编辑模式下，返回 `undefined`。

请使用自包含模型，或来自当前文档的模型。以下示例要求组件已加载且处于编辑模式：

```ts
import { createImageElement } from 'pptx-viewer-core';

const image = createImageElement(pngDataUrl, { x: 40, y: 40, width: 160, height: 90 });
const insertedId = viewer.addElement(image);
```

此方法不会安装剪贴板监听器、请求远程 URL、决定图片尺寸或导入其他文档的关系。宿主自己的粘贴处理器可以读取图片后调用它。对于新的 data URL 图片，使用上面的工厂函数即可，不要编造 `imagePath`，因为该字段表示归档中已有的部件。

### 加载本地图片 {#image-file}

此包还导出 `createImageElementFromFile(file, canvasSize, signal?)`。传入本地 `File` 或 `Blob`、以像素为单位的幻灯片尺寸，以及可选的 `AbortSignal`：

```ts
import { createImageElementFromFile } from 'pptx-vanilla-viewer';

const image = await createImageElementFromFile(file, canvasSize, signal);
```

此函数保留图片字节，返回居中且等比例缩小至幻灯片范围内的 `ImagePptxElement`，不会放大小图。图片或尺寸无效、读取或解码失败、取消操作或缺少浏览器 API 时，返回 `null`。此辅助函数只会在调用时使用浏览器 API；解码需要这些 API。

它只构造元素，不会修改文档、历史记录、选择状态或剪贴板。`await` 后，必须确认仍是同一文档和当前目标幻灯片，且仍有编辑权限，然后将非空结果传给 `addElement`。放弃目标时应取消等待中的操作。仅凭幻灯片 ID 不能确认文档身份；浏览器解码成功也不保证所有图片格式在 PowerPoint 中均能正确保存并重新打开。此函数不会自动安装粘贴监听器。

## 实时协作 {#collaboration}

| 方法                     | 签名                                             | 说明                                                                                                |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `startCollaboration`     | `(config: CollaborationConfig) => Promise<void>` | 启动或重新启动实时会话，传输创建后解析 Promise。状态通过 `onCollaborationStatus` 传递。             |
| `stopCollaboration`      | `() => void`                                     | 停止当前会话，没有活动会话时不执行操作。                                                            |
| `getCollaborationStatus` | `() => ConnectionStatus`                         | 当前状态：`'disconnected' \| 'connecting' \| 'connected' \| 'error'`，未激活时为 `'disconnected'`。 |

`CollaborationConfig` 及通信格式注意事项请参见[选项](/zh/vanilla/options#collaboration)。

## 自动保存 {#autosave}

| 方法                 | 签名                         | 说明                                         |
| -------------------- | ---------------------------- | -------------------------------------------- |
| `autosaveNow`        | `() => Promise<void>`        | 强制立即生成快照，自动保存禁用时不执行操作。 |
| `setAutosaveEnabled` | `(enabled: boolean) => void` | 无需重新构建即可启用或禁用恢复自动保存。     |
| `isAutosaveEnabled`  | `() => boolean`              | 当前是否启用了恢复自动保存。                 |

## 扩展与高级入口 {#extension-escape-hatches}

| 方法          | 签名                            | 说明                                                                              |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `getRegistry` | `() => ElementRendererRegistry` | 当前使用的元素渲染器注册表，是扩展入口。参见[元素渲染器](/zh/vanilla/renderers)。 |
| `getHandler`  | `() => PptxHandler \| null`     | 已加载文件的活动 `pptx-viewer-core` 处理器，未加载时为 `null`。                   |

### 核心引擎入口 {#core-escape-hatch}

`getHandler()` 暴露查看器背后完整的 [`pptx-viewer-core`](/zh/core/) `PptxHandler`，可执行查看器本身未提供的操作，例如将文稿转换为 Markdown，或读取底层归档的某些部分。如果只是序列化，请优先使用实例自身的 `save()` / `getContent()`，它们还会清除未保存修改标记。

```ts
const handler = viewer.getHandler();
if (handler) {
	const bytes = await handler.save(handler.pptxData!.slides); // Uint8Array
}
```

## 销毁 {#teardown}

| 方法      | 签名         | 说明                                      |
| --------- | ------------ | ----------------------------------------- |
| `destroy` | `() => void` | 清理 DOM、监听器、Blob URL 和核心处理器。 |

## 示例：外部控件 {#example-external-controls}

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/deck.pptx',
	showToolbar: false,
	showThumbnails: false,
	onSlideChange: (i) => {
		counter.textContent = `Slide ${i + 1} of ${viewer.getSlideCount()}`;
	},
});

prevButton.addEventListener('click', () => viewer.prev());
nextButton.addEventListener('click', () => viewer.next());
fitButton.addEventListener('click', () => viewer.zoomToFit());
presentButton.addEventListener('click', () => void viewer.enterPresentation());
pdfButton.addEventListener('click', () => void viewer.exportPdf());
```

## 可打开的文件类型 {#openable-file-kinds}

包根入口重新导出统一的文件类型判断，避免宿主的拖放区域、`<input accept>` 和加载器各自使用不同规则。手写 `endsWith` 容易逐渐不一致：本仓库的演示应用曾使用 `.pptx,.ppt,.json`，导致拖入 `.pptm` 被拒绝，而组件内部的**文件 > 打开**却可以正常读取。

```ts
import {
	PPTX_OPEN_ACCEPT,
	PRESENTATION_OPEN_EXTENSIONS,
	isSupportedPresentationFile,
	isLegacyBinaryPresentation,
	presentationBaseName,
	savedPresentationFileName,
	type SavedPresentationFormat,
} from 'pptx-vanilla-viewer';
```

| 导出项                         | 类型                                                                  | 说明                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PPTX_OPEN_ACCEPT`             | `string`                                                              | 可直接用于 `<input type="file" accept>`：`.pptx,.ppsx,.pptm,.potx,.ppt,.json`。                                |
| `PRESENTATION_OPEN_EXTENSIONS` | `readonly string[]`                                                   | 未拼接的同一扩展名列表，供拖放区域自行判断。                                                                   |
| `isSupportedPresentationFile`  | `(name?: string \| null) => boolean`                                  | 根据选择或拖入的文件名进行快速预筛选，只检查扩展名，最终格式由加载器检测。                                     |
| `isLegacyBinaryPresentation`   | `(name?: string \| null) => boolean`                                  | 判断是否属于 PowerPoint 97-2003 二进制格式（`.ppt`、`.pps`、`.pot`），这些格式可读取，不属于此保存接口的输出。 |
| `presentationBaseName`         | `(name?: string \| null, fallback?: string) => string`                | 去除目录和可加载扩展名，得到文件主名，例如 `decks/report.ppt` 变为 `report`。                                  |
| `savedPresentationFileName`    | `(name?: string \| null, format?: SavedPresentationFormat) => string` | 生成保存副本时提供的文件名，例如 `report.ppt` 变为 `report.pptx`。                                             |
| `SavedPresentationFormat`      | `'pptx' \| 'ppsx' \| 'pptm'`                                          | 此保存路径可生成的格式，不包含二进制 `.ppt`，输出始终为 OpenXML。                                              |

“另存为”时应使用 `savedPresentationFileName`。此路径输出的是 OpenXML 包，如果保留旧版源扩展名，会得到扩展名为 `.ppt`、内容却是 ZIP 的文件，PowerPoint 会拒绝打开。
