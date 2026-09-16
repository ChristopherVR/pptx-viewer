---
title: Svelte 查看器实例 API
description: 通过 bind:this 暴露在组件实例上的 PowerPointViewerApi 接口，涵盖导航、缩放、模式、幻灯片和元素操作、选择、编辑、保存及导出。
---

# 实例 API {#instance-api}

通过 `bind:this` 获取的组件实例实现 `PowerPointViewerApi`：共享的跨绑定查看器约定，与 React ref 句柄和 Vue `defineExpose` 背后的约定相同，再加上 Svelte 绑定的编辑和导出方法。所有工具栏操作都有对应的实例方法，因此可以隐藏界面控件（`showToolbar={false}`、`showThumbnails={false}`），从自己的界面驱动查看器。

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
</script>

<PowerPointViewer source={bytes} bind:this={viewer} />
```

::: info 返回快照，而非 store
getter 方法（`canUndo()`、`getZoom()`、`getSelectedElementIds()` 等）返回普通快照，不是响应式 store。需要响应变化时，请使用[组件属性](/zh/svelte/props#event-callbacks)中的回调属性，例如 `onzoomchange`、`onselectionchange`、`ondirtychange`。
:::

## 序列化 {#serialisation}

| 方法         | 签名                        | 说明                                                      |
| ------------ | --------------------------- | --------------------------------------------------------- |
| `getContent` | `() => Promise<Uint8Array>` | 将当前演示文稿序列化为 `.pptx` 字节，是 `save()` 的别名。 |

## 导航 {#navigation}

| 方法                  | 签名                      | 说明                                                |
| --------------------- | ------------------------- | --------------------------------------------------- |
| `goTo`                | `(index: number) => void` | 跳转到从 0 开始的幻灯片索引，自动限制在有效范围内。 |
| `goPrev`              | `() => void`              | 转到上一张幻灯片。                                  |
| `goNext`              | `() => void`              | 转到下一张幻灯片。                                  |
| `getActiveSlideIndex` | `() => number`            | 当前可见幻灯片的索引，从 0 开始。                   |
| `setActiveSlideIndex` | `(index: number) => void` | `goTo` 的别名。                                     |
| `getSlideCount`       | `() => number`            | 已加载演示文稿中的幻灯片数量。                      |

## 缩放 {#zoom}

| 方法        | 签名                      | 说明                                       |
| ----------- | ------------------------- | ------------------------------------------ |
| `getZoom`   | `() => number`            | 实际缩放比例，1 表示 100%。                |
| `setZoom`   | `(level: number) => void` | 设置明确的缩放比例，自动限制在有效范围内。 |
| `zoomIn`    | `() => void`              | 放大一级。                                 |
| `zoomOut`   | `() => void`              | 缩小一级。                                 |
| `zoomReset` | `() => void`              | 重置为 100%。                              |

## 模式与放映 {#mode-and-presentation}

| 方法      | 签名                         | 说明                                                                                                                    |
| --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `getMode` | `() => ViewerMode`           | 当前模式：`'preview' \| 'edit' \| 'present' \| 'master'`。                                                              |
| `setMode` | `(mode: ViewerMode) => void` | 切换模式。`'present'` 通过真实的 Fullscreen API 进入全屏放映，其他模式会退出全屏。`'edit'` 和 `'master'` 表示启用编辑。 |

```ts
viewer?.setMode('present'); // start presenting; Esc exits
```

## 访问与操作幻灯片 {#slide-access-and-manipulation}

| 方法               | 签名                                           | 说明                                               |
| ------------------ | ---------------------------------------------- | -------------------------------------------------- |
| `getSlides`        | `() => readonly PptxSlide[]`                   | 完整的幻灯片数组，返回包含完整类型信息的快照。     |
| `getSlide`         | `(index: number) => PptxSlide \| undefined`    | 按从 0 开始的索引获取单张幻灯片。                  |
| `getActiveSlide`   | `() => PptxSlide \| undefined`                 | 当前活动幻灯片。                                   |
| `addSlide`         | `(afterIndex?: number) => void`                | 在给定索引之后添加空白幻灯片，未指定时添加到末尾。 |
| `deleteSlides`     | `(indexes: number[]) => void`                  | 按索引删除幻灯片，至少保留一张。                   |
| `duplicateSlides`  | `(indexes: number[]) => void`                  | 复制给定索引的幻灯片。                             |
| `moveSlide`        | `(fromIndex: number, toIndex: number) => void` | 将幻灯片移动到新位置。                             |
| `toggleHideSlides` | `(indexes: number[]) => void`                  | 切换指定幻灯片的隐藏标记。                         |
| `isDirty`          | `() => boolean`                                | 文档是否存在未保存修改。                           |

## 访问与操作元素 {#element-access-and-manipulation}

| 方法               | 签名                                                                                   | 说明                                                                             |
| ------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `getElements`      | `(slideIndex?: number) => readonly PptxElement[]`                                      | 某张幻灯片上的元素，默认使用当前幻灯片。                                         |
| `getElementById`   | `(id: string, slideIndex?: number) => PptxElement \| undefined`                        | 按 ID 获取单个元素。                                                             |
| `updateElement`    | `(id: string, updates: Partial<PptxElement>) => void`                                  | 部分更新元素属性，例如 `{ x: 100, width: 300 }`。                                |
| `updateElements`   | `(updates: readonly ElementUpdate[], options?: ElementUpdateOptions) => Promise<void>` | [跨页批量更新元素，整批修改占用一个撤销步骤](/zh/guide/element-update-batches)。 |
| `deleteElements`   | `(ids: string[]) => void`                                                              | 按 ID 从当前幻灯片中删除元素。                                                   |
| `duplicateElement` | `(id: string) => string \| undefined`                                                  | 复制元素，返回新元素的 ID。                                                      |

## 插入元素 {#add-element}

`addElement(element: PptxElement): string | undefined` 将元素的防御性副本追加到当前可编辑幻灯片，选中它并返回新 ID。坐标保持不变，组合内的后代也会获得新 ID。未提交的文本通过已有编辑流程确认，正常更新未保存状态和撤销重做历史。同步编辑可能共用一条历史记录，但所有插入都会保留。加载期间、加载失败后、没有当前幻灯片时，以及只读、受保护、预览、放映、模板或母版编辑模式下，返回 `undefined`。

请使用自包含模型，或来自当前文档的模型。以下示例要求组件已加载且处于编辑模式：

```ts
import { createImageElement } from 'pptx-viewer-core';

const image = createImageElement(pngDataUrl, { x: 40, y: 40, width: 160, height: 90 });
const insertedId = viewer?.addElement(image);
```

此方法不会安装剪贴板监听器、请求远程 URL、决定图片尺寸或导入其他文档的关系。宿主自己的粘贴处理器可以读取图片后调用它。对于新的 data URL 图片，使用上面的工厂函数即可，不要编造 `imagePath`，因为该字段表示归档中已有的部件。

### 加载本地图片 {#image-file}

此包还导出 `createImageElementFromFile(file, canvasSize, signal?)`。传入本地 `File` 或 `Blob`、以像素为单位的幻灯片尺寸，以及可选的 `AbortSignal`：

```ts
import { createImageElementFromFile } from 'pptx-svelte-viewer';

const image = await createImageElementFromFile(file, canvasSize, signal);
```

此函数保留图片字节，返回居中且等比例缩小至幻灯片范围内的 `ImagePptxElement`，不会放大小图。图片或尺寸无效、读取或解码失败、取消操作或缺少浏览器 API 时，返回 `null`。此辅助函数只会在调用时使用浏览器 API；解码需要这些 API。

它只构造元素，不会修改文档、历史记录、选择状态或剪贴板。`await` 后，必须确认仍是同一文档和当前目标幻灯片，且仍有编辑权限，然后将非空结果传给 `addElement`。放弃目标时应取消等待中的操作。仅凭幻灯片 ID 不能确认文档身份；浏览器解码成功也不保证所有图片格式在 PowerPoint 中均能正确保存并重新打开。此函数不会自动安装粘贴监听器。

## 选择 {#selection}

| 方法                    | 签名                      | 说明                                 |
| ----------------------- | ------------------------- | ------------------------------------ |
| `getSelectedElementIds` | `() => string[]`          | 当前选中元素的 ID。                  |
| `selectElements`        | `(ids: string[]) => void` | 通过代码选择元素。                   |
| `clearSelection`        | `() => void`              | 清空选区。                           |
| `getSelectedElementId`  | `() => string \| null`    | 选中的顶层元素 ID，未选中时为 null。 |

## 编辑 {#editing}

设置 `editable` 时启用，参见[快速上手 > 编辑](/zh/svelte/getting-started#editing)。

| 方法                | 签名                                                           | 说明                                                           |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `undo`              | `() => void`                                                   | 撤销上一次提交的编辑。                                         |
| `redo`              | `() => void`                                                   | 重做上一次撤销的编辑。                                         |
| `canUndo`           | `() => boolean`                                                | 是否存在可撤销步骤，返回快照，不具备响应性。                   |
| `canRedo`           | `() => boolean`                                                | 是否存在可重做步骤。                                           |
| `deleteSelected`    | `() => void`                                                   | 删除选中元素，未选中时不执行操作。                             |
| `save`              | `(format?: PptxSaveFormat) => Promise<Uint8Array>`             | 将编辑后的幻灯片序列化为字节（`'pptx' \| 'ppsx' \| 'pptm'`）。 |
| `downloadAs`        | `(format: PptxSaveFormat, fileName?: string) => Promise<void>` | 保存并以指定格式触发浏览器下载。                               |
| `downloadPptx`      | `(fileName?: string) => Promise<void>`                         | 保存并以默认名称下载 `.pptx`。                                 |
| `packageForSharing` | `(fileName?: string) => Promise<void>`                         | 组装并下载共享包。                                             |

启用编辑时可使用以下键盘快捷键：`Ctrl` / `Cmd+Z` 撤销，`Ctrl` / `Cmd+Shift+Z` 重做，`Delete` / `Backspace` 删除，`Ctrl` / `Cmd+D` 复制，方向键微移（配合 `Shift` 使用更大步长），`Escape` 取消选择。

## 导出与打印 {#export-and-print}

| 方法               | 签名                                              | 说明                                                 |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------- |
| `exportSlidePng`   | `(index?: number) => Promise<void>`               | 将幻灯片导出为 PNG 并下载，默认使用当前幻灯片。      |
| `copySlideAsImage` | `(index?: number) => Promise<void>`               | 将幻灯片作为 PNG 图片复制到系统剪贴板。              |
| `exportPdf`        | `(options?: ExportPdfOptions) => Promise<void>`   | 下载多页 PDF，每页一张幻灯片。                       |
| `exportGif`        | `(options?: ExportGifOptions) => Promise<void>`   | 下载动态 GIF。                                       |
| `exportVideo`      | `(options?: ExportVideoOptions) => Promise<void>` | 下载 WebM 视频。                                     |
| `print`            | `(options?: PrintOptions) => Promise<boolean>`    | 打开浏览器打印对话框，支持幻灯片、讲义、备注和大纲。 |

选项结构、处理流程和独立 SVG 导出函数请参见[导出与打印](/zh/svelte/export)。

## 示例：外部控件 {#example-external-controls}

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
	let current = $state(0);
	let count = $state(0);
</script>

<PowerPointViewer
	source={bytes}
	showToolbar={false}
	showThumbnails={false}
	bind:this={viewer}
	onload={({ slideCount }) => (count = slideCount)}
	onslidechange={(index) => (current = index)}
/>

<div>
	<button onclick={() => viewer?.goPrev()}>Prev</button>
	<span>Slide {current + 1} of {count}</span>
	<button onclick={() => viewer?.goNext()}>Next</button>
	<button onclick={() => viewer?.setMode('present')}>Present</button>
</div>
```

## 底层构建模块 {#lower-level-building-blocks}

`pptx-svelte-viewer/viewer` 入口还导出查看器内部不依赖框架的状态辅助接口：`ViewerState`、`PresentationLoader`、`clampSlideIndex`、`fitScale`、`resolveNavigationKey`、`zoomInPercent`、`zoomOutPercent`，供宿主基于相同基础能力构建自定义界面。这些接口比组件 API 更底层，常规嵌入场景无需使用。

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
} from 'pptx-svelte-viewer';
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
