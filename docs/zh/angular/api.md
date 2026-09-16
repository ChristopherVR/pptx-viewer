---
title: 公开 API
description: PowerPointViewerComponent 实例公开的方法，用于编程控制导航、撤销与重做、缩放、模式、选择和内容序列化。
---

# 公开 API {#public-api}

Angular 没有 React 那样的 `forwardRef` 命令式句柄。`PowerPointViewerComponent` 的编程 API 就是**组件实例上的公开方法**，可以通过模板引用变量或 Angular 的 `viewChild()` 信号查询访问。

```ts
import { Component, viewChild } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-editor',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<button (click)="save()">Save</button>
		<button (click)="viewer().goNext()">Next Slide</button>
		<button (click)="viewer().undo()">Undo</button>
		<pptx-viewer #viewer [content]="content" [canEdit]="true" />
	`,
})
export class EditorComponent {
	readonly viewer = viewChild.required(PowerPointViewerComponent);

	async save(): Promise<void> {
		const bytes = await this.viewer().getContent();
		// persist `bytes` (a Uint8Array)
	}
}
```

::: tip 模板引用与 `viewChild`
也可以在模板中使用 `#viewer`，并声明 `@ViewChild(PowerPointViewerComponent) viewer!: PowerPointViewerComponent`，参见组件包 README。上面使用的 `viewChild()` 是现代的信号版本。两种方式取得的是同一个组件实例和相同的方法。
:::

## 各绑定共享的接口约定 {#contract-shared-across-bindings}

下面的方法实现了同一个 `PowerPointViewerAPI` 约定（定义于 `pptx-viewer-shared`），React 的 `PowerPointViewerHandle` 和 Vue 的 `defineExpose` 接口也实现它。三种框架绑定提供等效 API，只是分别采用框架自身的惯例：React 的 `forwardRef` 句柄、Vue 的 `defineExpose` 和 Angular 的公开方法。

```ts
import type { PowerPointViewerAPI, ViewerMode } from 'pptx-angular-viewer';
```

## 方法 {#methods}

### 序列化 {#serialization}

| 方法         | 签名                        | 说明                                                                                |
| ------------ | --------------------------- | ----------------------------------------------------------------------------------- |
| `getContent` | `() => Promise<Uint8Array>` | 按需将当前文档序列化为 `.pptx` 字节。编辑状态下会序列化编辑后的文稿，并合并回模板。 |

### 导航 {#navigation}

| 方法     | 签名                      | 说明                                                    |
| -------- | ------------------------- | ------------------------------------------------------- |
| `goTo`   | `(index: number) => void` | 跳转到指定幻灯片，索引从 0 开始。超出范围时不执行操作。 |
| `goPrev` | `() => void`              | 跳转到上一页。                                          |
| `goNext` | `() => void`              | 跳转到下一页。                                          |

### 撤销与重做 {#undo-redo}

| 方法      | 签名            | 说明                                         |
| --------- | --------------- | -------------------------------------------- |
| `undo`    | `() => void`    | 撤销上一次编辑操作。没有可撤销操作时不执行。 |
| `redo`    | `() => void`    | 重做最后一次撤销的操作。                     |
| `canUndo` | `() => boolean` | 是否存在可撤销操作。                         |
| `canRedo` | `() => boolean` | 是否存在可重做操作。                         |

### 缩放 {#zoom}

| 方法        | 签名                      | 说明                                   |
| ----------- | ------------------------- | -------------------------------------- |
| `getZoom`   | `() => number`            | 获取当前缩放比例，1 表示 100%。        |
| `setZoom`   | `(level: number) => void` | 设置缩放级别，限制在 0.2 至 3.0 之间。 |
| `zoomIn`    | `() => void`              | 放大一级。                             |
| `zoomOut`   | `() => void`              | 缩小一级。                             |
| `zoomReset` | `() => void`              | 重置为 100%。                          |

### 模式 {#mode}

| 方法      | 签名                     | 说明                                                                                            |
| --------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `getMode` | `() => string`           | 获取当前查看器模式：`'preview'`、`'edit'`、`'present'` 或 `'master'`。                          |
| `setMode` | `(mode: string) => void` | 通过代码切换模式。`'present'` 进入放映，`'master'` 进入模板编辑，其他值返回普通预览或编辑模式。 |

### 只读状态 {#read-only-state}

| 方法                  | 签名                      | 说明                            |
| --------------------- | ------------------------- | ------------------------------- |
| `getActiveSlideIndex` | `() => number`            | 获取当前幻灯片索引，从 0 开始。 |
| `setActiveSlideIndex` | `(index: number) => void` | 设置当前幻灯片，等同于 `goTo`。 |
| `getSlideCount`       | `() => number`            | 获取幻灯片总数。                |
| `isDirty`             | `() => boolean`           | 文档是否存在未保存修改。        |

### 访问幻灯片 {#slide-access}

幻灯片方法返回 `pptx-viewer-core` 中完整的 `PptxSlide` 对象，包含完整类型信息，例如元素、备注、切换效果和动画等。

| 方法             | 签名                                        | 说明                          |
| ---------------- | ------------------------------------------- | ----------------------------- |
| `getSlides`      | `() => readonly PptxSlide[]`                | 获取全部幻灯片。              |
| `getSlide`       | `(index: number) => PptxSlide \| undefined` | 按从 0 开始的索引获取幻灯片。 |
| `getActiveSlide` | `() => PptxSlide \| undefined`              | 获取当前幻灯片。              |

### 操作幻灯片 {#slide-manipulation}

| 方法               | 签名                                 | 说明                                 |
| ------------------ | ------------------------------------ | ------------------------------------ |
| `addSlide`         | `(afterIndex?: number) => void`      | 添加空白页，默认插在当前页之后。     |
| `deleteSlides`     | `(indexes: number[]) => void`        | 删除指定索引的幻灯片。               |
| `duplicateSlides`  | `(indexes: number[]) => void`        | 复制指定索引的幻灯片。               |
| `moveSlide`        | `(from: number, to: number) => void` | 将幻灯片从一个位置移动到另一个位置。 |
| `toggleHideSlides` | `(indexes: number[]) => void`        | 切换指定幻灯片的隐藏标记。           |

### 访问元素 {#element-access}

元素方法返回完整的 `PptxElement` 对象，它是文本、形状、图片、表格、图表、连接线、组合等类型的可辨识联合，包含各类型的完整属性。

| 方法             | 签名                                                                   | 说明                           |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `getElements`    | `(slideIndex?: number) => readonly PptxElement[]`                      | 获取元素，默认使用当前幻灯片。 |
| `getElementById` | `(elementId: string, slideIndex?: number) => PptxElement \| undefined` | 按 ID 获取元素。               |

### 操作元素 {#element-manipulation}

| 方法               | 签名                                                                                   | 说明                                                                             |
| ------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `updateElement`    | `(elementId: string, updates: Partial<PptxElement>) => void`                           | 局部更新元素属性。                                                               |
| `updateElements`   | `(updates: readonly ElementUpdate[], options?: ElementUpdateOptions) => Promise<void>` | [跨页批量更新元素，整批修改占用一个撤销步骤](/zh/guide/element-update-batches)。 |
| `deleteElements`   | `(elementIds: string[]) => void`                                                       | 按 ID 删除元素。                                                                 |
| `duplicateElement` | `(elementId: string) => string \| undefined`                                           | 复制元素并返回新元素 ID。                                                        |

### 插入元素 {#add-element}

`addElement(element: PptxElement): string | undefined` 将元素的防御性副本追加到当前可编辑幻灯片，选中它并返回新 ID。坐标保持不变，组合内的后代也会获得新 ID。未提交的文本通过已有编辑流程确认，正常更新未保存状态和撤销重做历史。同步编辑可能共用一条历史记录，但所有插入都会保留。加载期间、加载失败后、没有当前幻灯片时，以及只读、受保护、预览、放映、模板或母版编辑模式下，返回 `undefined`。

请使用自包含模型，或来自当前文档的模型。以下示例要求组件已加载且处于编辑模式：

```ts
import { createImageElement } from 'pptx-viewer-core';

const image = createImageElement(pngDataUrl, { x: 40, y: 40, width: 160, height: 90 });
const insertedId = this.viewer().addElement(image);
```

此方法不会安装剪贴板监听器、请求远程 URL、决定图片尺寸或导入其他文档的关系。宿主自己的粘贴处理器可以读取图片后调用它。对于新的 data URL 图片，使用上面的工厂函数即可，不要编造 `imagePath`，因为该字段表示归档中已有的部件。

#### 加载本地图片 {#image-file}

此包还导出 `createImageElementFromFile(file, canvasSize, signal?)`。传入本地 `File` 或 `Blob`、以像素为单位的幻灯片尺寸，以及可选的 `AbortSignal`：

```ts
import { createImageElementFromFile } from 'pptx-angular-viewer';

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

```ts
@Component({
	template: `
		<button (click)="viewer().goPrev()">Prev</button>
		<button (click)="viewer().goNext()">Next</button>
		<span>Slide {{ viewer().getActiveSlideIndex() + 1 }}</span>
		<span>{{ viewer().getActiveSlide()?.elements?.length }} elements</span>
		<button (click)="viewer().zoomIn()">Zoom In</button>
		<button (click)="viewer().zoomOut()">Zoom Out</button>
		<button (click)="viewer().undo()" [disabled]="!viewer().canUndo()">Undo</button>
		<button (click)="viewer().addSlide()">Add Slide</button>
		<pptx-viewer #ref [content]="content" [canEdit]="true" />
	`,
})
export class ToolbarComponent {
	readonly viewer = viewChild.required(PowerPointViewerComponent, {
		read: PowerPointViewerComponent,
	});
}
```

::: tip getContent 与 contentChange
`getContent()` 是拉取式 API，可在点击保存按钮等时机按需序列化。`contentChange` 是推送事件，在文档变化时携带最新字节触发。可以根据保存方式选择，两者返回等效的 `Uint8Array` 内容。
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
} from 'pptx-angular-viewer';
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
