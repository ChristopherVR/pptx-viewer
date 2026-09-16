---
title: 命令式句柄
description: 通过 PowerPointViewerHandle ref API 控制导航、撤销重做、缩放、模式、选择和内容序列化。
---

# 命令式句柄 {#imperative-handle}

`PowerPointViewer` 使用 `forwardRef`。为它绑定 `PowerPointViewerHandle` 类型的 ref，即可调用命令式 API。

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerHandle } from 'pptx-react-viewer';
import { useRef } from 'react';

function Editor({ content }: { content: Uint8Array }) {
	const ref = useRef<PowerPointViewerHandle>(null);

	async function save() {
		const bytes = await ref.current?.getContent();
		if (bytes) {
			// persist `bytes` (a Uint8Array)
		}
	}

	return (
		<>
			<button onClick={save}>Save</button>
			<button onClick={() => ref.current?.goNext()}>Next Slide</button>
			<button onClick={() => ref.current?.undo()}>Undo</button>
			<PowerPointViewer ref={ref} content={content} canEdit />
		</>
	);
}
```

## 接口 {#interface}

`PowerPointViewerHandle` 扩展 `FileViewerHandle`，并实现 `pptx-viewer-shared` 中定义的共享 `PowerPointViewerAPI` 约定。React、Vue 和 Angular 三种组件暴露相同的 API。

```ts
import type { ViewerMode, PowerPointViewerAPI } from 'pptx-react-viewer';
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
const insertedId = ref.current?.addElement(image);
```

`useViewerBuildingBlocks` 的公共句柄也提供相同方法。

此方法不会安装剪贴板监听器、请求远程 URL、决定图片尺寸或导入其他文档的关系。宿主自己的粘贴处理器可以读取图片后调用它。对于新的 data URL 图片，使用上面的工厂函数即可，不要编造 `imagePath`，因为该字段表示归档中已有的部件。

#### 加载本地图片 {#image-file}

此包还导出 `createImageElementFromFile(file, canvasSize, signal?)`。传入本地 `File` 或 `Blob`、以像素为单位的幻灯片尺寸，以及可选的 `AbortSignal`：

```ts
import { createImageElementFromFile } from 'pptx-react-viewer';

const image = await createImageElementFromFile(file, canvasSize, signal);
```

此函数保留图片字节，返回居中且等比例缩小至幻灯片范围内的 `ImagePptxElement`，不会放大小图。图片或尺寸无效、读取或解码失败、取消操作或缺少浏览器 API 时，返回 `null`。此辅助函数只会在调用时使用浏览器 API；解码需要这些 API。

它只构造元素，不会修改文档、历史记录、选择状态或剪贴板。`await` 后，必须确认仍是同一文档和当前目标幻灯片，且仍有编辑权限，然后将非空结果传给 `addElement`。放弃目标时应取消等待中的操作。仅凭幻灯片 ID 不能确认文档身份；浏览器解码成功也不保证所有图片格式在 PowerPoint 中均能正确保存并重新打开。此函数不会自动安装粘贴监听器。

### 选择 {#selection}

| 方法                    | 签名                      | 说明                    |
| ----------------------- | ------------------------- | ----------------------- |
| `getSelectedElementIds` | `() => string[]`          | 获取当前选中的元素 ID。 |
| `selectElements`        | `(ids: string[]) => void` | 按 ID 选择元素。        |
| `clearSelection`        | `() => void`              | 清空选择。              |

## 示例：外部控件 {#example-external-controls}

```tsx
function Toolbar({ viewerRef }: { viewerRef: React.RefObject<PowerPointViewerHandle> }) {
	const slide = viewerRef.current?.getActiveSlide();

	return (
		<div>
			<button onClick={() => viewerRef.current?.goPrev()}>Prev</button>
			<button onClick={() => viewerRef.current?.goNext()}>Next</button>
			<span>Slide {(viewerRef.current?.getActiveSlideIndex() ?? 0) + 1}</span>
			<span>{slide?.elements.length} elements</span>
			<button onClick={() => viewerRef.current?.zoomIn()}>Zoom In</button>
			<button onClick={() => viewerRef.current?.zoomOut()}>Zoom Out</button>
			<button onClick={() => viewerRef.current?.undo()} disabled={!viewerRef.current?.canUndo()}>
				Undo
			</button>
			<button onClick={() => viewerRef.current?.addSlide()}>Add Slide</button>
		</div>
	);
}
```

## 示例：读取幻灯片数据 {#example-reading-slide-data}

```tsx
function SlideInspector({ viewerRef }: { viewerRef: React.RefObject<PowerPointViewerHandle> }) {
	const slides = viewerRef.current?.getSlides() ?? [];

	return (
		<ul>
			{slides.map((slide, i) => (
				<li key={slide.id}>
					Slide {i + 1}: {slide.elements.length} elements
					{slide.hidden && ' (hidden)'}
				</li>
			))}
		</ul>
	);
}
```

::: tip getContent 与 onContentChange
`getContent()` 是主动获取接口，可在用户点击保存时按需序列化。`onContentChange` 则在文档变化时主动推送最新字节。两者返回等价的 `Uint8Array` 内容，可以根据保存模型选择。
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
} from 'pptx-react-viewer';
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
