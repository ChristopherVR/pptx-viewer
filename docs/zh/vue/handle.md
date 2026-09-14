---
title: 命令式句柄
description: PowerPointViewerExpose 的 defineExpose API 提供导航、撤销与重做、缩放、模式、选择和内容序列化的编程接口。
---

# 命令式句柄 {#imperative-handle}

`PowerPointViewer` 通过 Vue 的 `defineExpose` 暴露命令式 API，可以通过类型为 `PowerPointViewerExpose` 的模板 ref 获取。

```vue
<script setup lang="ts">
import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer';
import { ref } from 'vue';

const props = defineProps<{ content: Uint8Array }>();
const viewer = ref<PowerPointViewerExpose>();

async function save(): Promise<void> {
	const bytes = await viewer.value?.getContent();
	if (bytes) {
		// persist `bytes` (a Uint8Array)
	}
}
</script>

<template>
	<button @click="save">Save</button>
	<button @click="viewer?.goNext()">Next Slide</button>
	<button @click="viewer?.undo()">Undo</button>
	<PowerPointViewer ref="viewer" :content="props.content" can-edit />
</template>
```

## 接口 {#interface}

`PowerPointViewerExpose` 继承共享的 `PowerPointViewerAPI` 约定（定义于 `pptx-viewer-shared`），并添加 `getContent`。三种框架绑定（React、Vue、Angular）暴露相同的 API：React 通过 `forwardRef` 和 `PowerPointViewerHandle` 访问，Vue 通过 `defineExpose`，Angular 通过组件公开方法。

```ts
import type { PowerPointViewerExpose } from 'pptx-vue-viewer';
import type { ViewerMode, PowerPointViewerAPI } from 'pptx-viewer-shared';
```

## 方法 {#methods}

### 序列化 {#serialization}

| 方法         | 签名                        | 说明                                      |
| ------------ | --------------------------- | ----------------------------------------- |
| `getContent` | `() => Promise<Uint8Array>` | 按需将当前文档序列化为 `.pptx` 字节数据。 |

### 导航 {#navigation}

| 方法     | 签名                           | 说明                              |
| -------- | ------------------------------ | --------------------------------- |
| `goTo`   | `(slideIndex: number) => void` | 跳转到指定幻灯片，索引从 0 开始。 |
| `goPrev` | `() => void`                   | 跳转到上一页。                    |
| `goNext` | `() => void`                   | 跳转到下一页。                    |

### 撤销与重做 {#undo-redo}

| 方法      | 签名            | 说明                     |
| --------- | --------------- | ------------------------ |
| `undo`    | `() => void`    | 撤销最后一次编辑。       |
| `redo`    | `() => void`    | 重做最后一次撤销的操作。 |
| `canUndo` | `() => boolean` | 是否存在可撤销操作。     |
| `canRedo` | `() => boolean` | 是否存在可重做操作。     |

### 缩放 {#zoom}

| 方法        | 签名                      | 说明                                   |
| ----------- | ------------------------- | -------------------------------------- |
| `getZoom`   | `() => number`            | 获取当前缩放比例，1 表示 100%。        |
| `setZoom`   | `(level: number) => void` | 设置缩放比例，限制在 0.2 到 5.0 之间。 |
| `zoomIn`    | `() => void`              | 放大一步，步长为 10%。                 |
| `zoomOut`   | `() => void`              | 缩小一步，步长为 10%。                 |
| `zoomReset` | `() => void`              | 重置为 100%。                          |

::: info 缩放范围与 React 略有不同
Vue 和 React 查看器都会将缩放限制在 `0.2` 至 `5.0`（500%）之间。
:::

### 模式 {#mode}

| 方法      | 签名                         | 说明                                                      |
| --------- | ---------------------------- | --------------------------------------------------------- |
| `getMode` | `() => ViewerMode`           | 获取当前模式。                                            |
| `setMode` | `(mode: ViewerMode) => void` | 切换到 `'preview'`、`'edit'`、`'present'` 或 `'master'`。 |

### 状态访问 {#read-only-state}

| 方法                  | 签名                      | 说明                            |
| --------------------- | ------------------------- | ------------------------------- |
| `getActiveSlideIndex` | `() => number`            | 获取当前幻灯片索引，从 0 开始。 |
| `setActiveSlideIndex` | `(index: number) => void` | 设置当前幻灯片，等同于 `goTo`。 |
| `getSlideCount`       | `() => number`            | 获取幻灯片总数。                |
| `isDirty`             | `() => boolean`           | 文档是否存在未保存修改。        |

### 访问幻灯片 {#slide-access}

所有幻灯片方法都返回 `pptx-viewer-core` 中完整的 `PptxSlide` 对象，包含元素、备注、切换和动画等完整类型信息。

| 方法             | 签名                                        | 说明                          |
| ---------------- | ------------------------------------------- | ----------------------------- |
| `getSlides`      | `() => readonly PptxSlide[]`                | 获取全部幻灯片。              |
| `getSlide`       | `(index: number) => PptxSlide \| undefined` | 按从 0 开始的索引获取幻灯片。 |
| `getActiveSlide` | `() => PptxSlide \| undefined`              | 获取当前幻灯片。              |

### 操作幻灯片 {#slide-manipulation}

| 方法               | 签名                                 | 说明                                 |
| ------------------ | ------------------------------------ | ------------------------------------ |
| `addSlide`         | `(afterIndex?: number) => void`      | 添加空白页，默认插在当前页之后。     |
| `deleteSlides`     | `(indexes: number[]) => void`        | 删除指定索引的幻灯片，至少保留一页。 |
| `duplicateSlides`  | `(indexes: number[]) => void`        | 复制指定索引的幻灯片。               |
| `moveSlide`        | `(from: number, to: number) => void` | 将幻灯片从一个位置移动到另一个位置。 |
| `toggleHideSlides` | `(indexes: number[]) => void`        | 切换指定幻灯片的隐藏标记。           |

### 访问元素 {#element-access}

元素方法返回完整的 `PptxElement` 对象，即文本、形状、图片、表格、图表、连接线和组合等类型的可辨识联合，保留各类型专有属性。

| 方法             | 签名                                                            | 说明                           |
| ---------------- | --------------------------------------------------------------- | ------------------------------ |
| `getElements`    | `(slideIndex?: number) => readonly PptxElement[]`               | 获取元素，默认使用当前幻灯片。 |
| `getElementById` | `(id: string, slideIndex?: number) => PptxElement \| undefined` | 按 ID 获取元素。               |

### 操作元素 {#element-manipulation}

| 方法               | 签名                                                  | 说明                      |
| ------------------ | ----------------------------------------------------- | ------------------------- |
| `updateElement`    | `(id: string, updates: Partial<PptxElement>) => void` | 局部更新元素属性。        |
| `deleteElements`   | `(ids: string[]) => void`                             | 按 ID 删除元素。          |
| `duplicateElement` | `(id: string) => string \| undefined`                 | 复制元素并返回新元素 ID。 |

### 插入元素 {#add-element}

`addElement(element: PptxElement): string | undefined` 将元素的防御性副本追加到当前可编辑幻灯片，选中它并返回新 ID。坐标保持不变，组合内的后代也会获得新 ID。未提交的文本通过已有编辑流程确认，正常更新未保存状态和撤销重做历史。同步编辑可能共用一条历史记录，但所有插入都会保留。加载期间、加载失败后、没有当前幻灯片时，以及只读、受保护、预览、放映、模板或母版编辑模式下，返回 `undefined`。

请使用自包含模型，或来自当前文档的模型。以下示例要求组件已加载且处于编辑模式：

```ts
import { createImageElement } from 'pptx-viewer-core';

const image = createImageElement(pngDataUrl, { x: 40, y: 40, width: 160, height: 90 });
const insertedId = viewer.value?.addElement(image);
```

此方法不会安装剪贴板监听器、请求远程 URL、决定图片尺寸或导入其他文档的关系。宿主自己的粘贴处理器可以读取图片后调用它。对于新的 data URL 图片，使用上面的工厂函数即可，不要编造 `imagePath`，因为该字段表示归档中已有的部件。

### 选择 {#selection}

| 方法                    | 签名                      | 说明                    |
| ----------------------- | ------------------------- | ----------------------- |
| `getSelectedElementIds` | `() => string[]`          | 获取当前选中的元素 ID。 |
| `selectElements`        | `(ids: string[]) => void` | 按 ID 选择元素。        |
| `clearSelection`        | `() => void`              | 清空选择。              |

## 示例：外部控件 {#example-external-controls}

```vue
<script setup lang="ts">
import type { PowerPointViewerExpose } from 'pptx-vue-viewer';
import { computed } from 'vue';

const props = defineProps<{ viewer: PowerPointViewerExpose | undefined }>();
const slide = computed(() => props.viewer?.getActiveSlide());
</script>

<template>
	<div>
		<button @click="viewer?.goPrev()">Prev</button>
		<button @click="viewer?.goNext()">Next</button>
		<span>Slide {{ (viewer?.getActiveSlideIndex() ?? 0) + 1 }}</span>
		<span>{{ slide?.elements.length }} elements</span>
		<button @click="viewer?.zoomIn()">Zoom In</button>
		<button @click="viewer?.zoomOut()">Zoom Out</button>
		<button :disabled="!viewer?.canUndo()" @click="viewer?.undo()">Undo</button>
		<button @click="viewer?.addSlide()">Add Slide</button>
	</div>
</template>
```

::: tip getContent 与 @content-change
`getContent()` 是拉取式 API，可在点击保存按钮等时机按需序列化。`@content-change` 是推送事件，在文档变化时携带最新字节触发。可以根据保存方式选择，两者返回等效的 `Uint8Array` 内容。
:::

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
} from 'pptx-vue-viewer';
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
