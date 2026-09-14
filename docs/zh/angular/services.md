---
title: 服务
description: PowerPointViewerComponent 的服务架构、pptx-angular-viewer 导出的精选公开服务，以及一同提供的完整内部接口。
---

# 服务 {#services}

`PowerPointViewerComponent` 是轻量的 `OnPush`、信号驱动编排器。绝大部分逻辑位于约四十多个 `@Injectable` **编排服务**中，这些服务在组件上提供（`providers: [...]`），并通过 `inject()` 接线，另有 200 多个独立子组件和普通辅助函数。这是 React 的 80 多个自定义 Hook 和 Vue 组合式函数对应的 Angular 实现，使用相同的职责拆分，但以 Angular 自身的惯例表达：可注入的服务和基于信号的状态，而不是 Hook 闭包。

::: info 公开接口与内部接口
多数此类构建模块属于**内部架构**，依赖特定的组合顺序和共享输入。下列精选子集是预期供用户使用的公开接口，从 `pptx-angular-viewer` 包根入口导出。**完整**接口可从 `pptx-angular-viewer/internals` 子路径导入，但内部构建模块不受语义化版本兼容承诺保障，因此应优先使用稳定的根入口导出。ng-packagr 将此包构建为单一编译单元，因此 `internals` 是同一产物的别名，而非隔离的产物，这些符号也仍可从根入口导入。参见[完整服务参考](/zh/angular/services-reference)。
:::

## 依赖注入配置 {#di-setup}

所有查看器服务均声明为普通的 `@Injectable()`，不使用 `providedIn: 'root'`。`PowerPointViewerComponent` 在自己的 `providers` 数组中列出全部服务，因此每个查看器实例都有独立的服务树，同一页面上的两个查看器不会共享状态。没有全局注册，也无需调用 `provide*` 启动函数。

需要在查看器组件之外独立使用服务时，请在合适的作用域自行提供并注入：

```ts
import { Component, inject } from '@angular/core';
import { LoadContentService, EditorStateService } from 'pptx-angular-viewer';

@Component({
	selector: 'app-headless-deck',
	standalone: true,
	providers: [LoadContentService, EditorStateService],
	template: `<p>{{ loader.slideCount() }} slides</p>`,
})
export class HeadlessDeckComponent {
	readonly loader = inject(LoadContentService);
	readonly editor = inject(EditorStateService);
}
```

服务分为两类，其中只有一类适合独立使用：

- **自包含状态服务**，例如 `LoadContentService`、`EditorStateService`、`ExportService`、`CollaborationService`、`ViewerZoomService`、`IsMobileService` 等，使用信号管理自身状态，可以在任何提供了它们的地方工作。
- **`Viewer*` 编排服务**，例如 `ViewerFileIOService`、`ViewerExportService`、`ViewerCanvasEditingService` 等，要求宿主组件在构造函数中调用 `bind(host)` 传入一组访问器，未调用时使用会抛出错误（`"...bind() was not called"`）。导出它们是为了接口完整性，不是为了独立使用。

## 编排服务（内部架构） {#orchestration-services-internal-architecture}

这些服务说明了查看器的组装方式。此表用于理解架构，并非 API 兼容性约定。

| 服务                                                                                                  | 职责                                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `EditorStateService`                                                                                  | 文档状态，包括幻灯片、选区、撤销和重做历史、模板元素。                                             |
| `LoadContentService`                                                                                  | 加载时解析 `.pptx` 缓冲区，并管理画布尺寸、媒体 data URL 和嵌入字体。                              |
| `ViewerFileIOService`                                                                                 | “文件 > 打开 / 另存为”编排、内容覆盖和 `getContent()`。                                            |
| `AutosaveService`                                                                                     | 周期性自动保存调度和状态，将恢复快照写入 IndexedDB。                                               |
| `ViewerZoomService`                                                                                   | 缩放级别状态，包括 `zoom`、`zoomPercent`、`zoomIn`、`zoomOut` 和 `zoomReset`。                     |
| `ZoomNavigationService`                                                                               | PowerPoint“缩放定位”（摘要缩放定位或节缩放定位）的导航目标。                                       |
| `ZoomTargetService`                                                                                   | 从当前文稿解析缩放定位磁贴的回退缩略图信息，包括背景、编号和节。                                   |
| `ViewerCanvasEditingService`                                                                          | 画布编辑编排，包括元素选择、背景点击、变换、文本、墨迹和表格单元格编辑。                           |
| `ViewerInspectorPanelService`                                                                         | 右侧检查器面板切换，包括元素、幻灯片、批注、签名、无障碍和选区。                                   |
| `ViewerFormatPainterService`                                                                          | 格式刷和吸管工具状态。                                                                             |
| `ViewerFindReplaceService`                                                                            | 查找和替换栏状态，以及搜索和替换操作。                                                             |
| `ViewerKeyboardService`                                                                               | 组件文档级 keydown 监听器的键盘快捷键分发。                                                        |
| `ViewerTouchGesturesService`                                                                          | 画布宿主上的双指缩放、滑动导航和长按手势接线。                                                     |
| `ViewerMobileSheetService`                                                                            | 移动端底部面板状态（幻灯片、菜单、备注）和快速插入操作。                                           |
| `ViewerPresentationModeService`                                                                       | 放映模式编排，包括进入、退出、演示者视图和观众窗口。                                               |
| `ViewerCustomShowsService`                                                                            | 自定义放映状态，用于放映幻灯片子集，以及放映幻灯片选择。                                           |
| `ViewerDocumentPropertiesService`                                                                     | 文档信息对话框和超链接对话框状态。                                                                 |
| `ViewerThemeGalleryService`                                                                           | 主题库对话框状态和主题预设应用。                                                                   |
| `ViewerExportService`                                                                                 | PNG、PDF、GIF、视频导出和打印编排，包含进度报告和取消。                                            |
| `CollaborationService`                                                                                | 会话的 Yjs CRDT 连接、同步和在线状态。                                                             |
| `ViewerCollaborationSessionService`                                                                   | 共享和广播对话框状态，以及会话连接和断开的编排。                                                   |
| `ViewerCollabCursorService`                                                                           | 跟踪本地指针，用于广播用户光标位置。                                                               |
| `TableSelectionService`                                                                               | 表格编辑器的单元格选区状态。                                                                       |
| `EmbeddedFontsService`                                                                                | 将演示文稿的嵌入字体注入为受管理的 `@font-face` 规则。                                             |
| `AccessibilityService`, `PrintService`, `IsMobileService`, `SmartArt3DService`, `FieldContextService` | 分别用于无障碍问题扫描、打印任务、设备和视口分类、可选三维 SmartArt 开关，以及字段和占位符上下文。 |

此外还有墨迹绘制、标尺参考线和画布适应尺寸等服务。按职责分组的完整列表请参见 **[完整服务参考](/zh/angular/services-reference)** 。

## 公开服务与组件 {#public-services-components}

以下内容由包根入口导出，可作为稳定接口导入，用于围绕查看器构建自定义界面，或通过代码驱动查看器。

### `LoadContentService` {#loadcontentservice}

加载 `.pptx`，并通过信号提供解析出的全部内容，包括 `slides`、`canvasSize`、`theme`、`slideMasters`、`mediaDataUrls`、`embeddedFonts`、`coreProperties`、`appProperties`、`sections`、`loading`、`error`、`isEncrypted`、`hasMacros` 等，以及计算得到的 `slideCount`。

| 成员                                     | 用途                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `load(raw)`                              | `(raw: Uint8Array \| ArrayBuffer \| null \| undefined) => Promise<void>`：解析缓冲区并写入这些信号。 |
| `getContent()`                           | `() => Promise<Uint8Array>`：将已加载的演示文稿序列化回字节。                                        |
| `saveSlides(slides, format?, sections?)` | 使用已加载演示文稿的处理器，序列化编辑后的文稿，例如 `EditorStateService` 中的幻灯片。               |

```ts
@Component({ providers: [LoadContentService] /* ... */ })
export class DeckStatsComponent {
	private readonly loader = inject(LoadContentService);

	async open(file: File): Promise<void> {
		await this.loader.load(await file.arrayBuffer());
		if (this.loader.error()) return;
		console.log(this.loader.slideCount(), this.loader.canvasSize());
	}
}
```

### `EditorStateService` {#editorstateservice}

基于信号的编辑状态，包括 `slides`、`sections`、`selectedIds`、`dirty`、`editTemplateMode`、`templateElementsBySlideId`、`canUndo` / `canRedo` / `undoLabel` / `redoLabel`，以及大量支持历史记录的命令式操作：`setSlides`、`updateElement(slideIndex, id, patch)`、`addElement`、`deleteSelected`、`duplicateSelected`、`moveSelectedBy`、`alignSelected`、`groupSelected`、`copySelected` / `paste`、`addSlide`、`deleteSlide`、`duplicateSlide`、`moveSlide`、`undo`、`redo` 等。

```ts
const editor = inject(EditorStateService);

editor.setSlides(loadedSlides); // clones, partitions template elements, resets history
editor.updateElement(0, 'el_12', { x: 120, y: 80 });
editor.select(['el_12']);
editor.duplicateSelected(0);
editor.undo();

const bytes = await this.loader.saveSlides(editor.snapshot());
```

### 实时协作 {#collaboration}

用于构建自定义协作界面或自行驱动同步。参见[实时协作](/zh/angular/collaboration)。

| 导出项                                        | 用途                                                                                                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CollaborationService`                        | 通过 `connect(config, options?)` / `disconnect()` / `retry()` 管理 Yjs 会话；提供 `status`、`presence`、`cursors`、`connectedCount` 信号，以及 `broadcastSlides`、`setCursor`、`setSelection`、`setActiveSlide`、`followUser` 方法。销毁时自动断开连接。 |
| `CollaborationCursorsComponent`               | 在幻灯片画布上渲染远程光标。                                                                                                                                                                                                                             |
| `RemoteSelectionOverlayComponent`（内部接口） | 渲染远程用户的元素选区高亮。                                                                                                                                                                                                                             |
| `collaboration-helpers` 的导出                | `validateRoomId`、`sanitizeUserName`、`derivePresenceList`、`assignUserColor` 等。                                                                                                                                                                       |

```ts
const collab = inject(CollaborationService);

await collab.connect(
	{ roomId: 'deck-42', serverUrl: 'wss://collab.example.com', userName: 'Ada' },
	{ onRemoteSlides: (slides) => this.editor.applyRemoteSlides(slides) },
);
```

### 渲染与渲染器 {#rendering-renderers}

`SlideCanvasComponent`、`ElementRendererComponent`、`ConnectorRendererComponent`、`TableRendererComponent`、`ChartRendererComponent`、`SmartArtRendererComponent`、`InkRendererComponent`、`OleRendererComponent`、`Model3DRendererComponent`、`ZoomRendererComponent`、`EquationRendererComponent`：由 `SlideCanvasComponent` 组合使用的各元素类型渲染器。

### 导出 {#export}

| 导出项           | 用途                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExportService`  | 幻灯片 SVG 导出（`exportSlideToSvg`、`exportAllSlidesToSvg`）、元素栅格化（`exportElementToPng`、`copyElementAsPng`、`renderElement`）、文件下载辅助函数（`savePptx`、`savePresentation`），以及将已渲染画布组装为 PDF、GIF 或 WebM。 |
| `renderToCanvas` | 独立的 `html2canvas-pro` 包装函数，兼容处理 oklch 颜色。参见[导出](/zh/angular/export)。                                                                                                                                              |

## 直接使用内部服务 {#using-an-internal-service-directly}

如果上面的精选公开服务无法满足需求，也可以从 `pptx-angular-viewer` 本身导入全部内部服务、组件和辅助函数，没有独立子路径：

```ts
import { ViewerZoomService, buildSaveSlides } from 'pptx-angular-viewer';
```

::: warning 内部构建模块
[完整服务参考](/zh/angular/services-reference)页面中的所有内容，都是 `PowerPointViewerComponent` 内部组合使用的相同构建模块，通过 `pptx-angular-viewer/internals` 子路径原样重新导出。它们**不受语义化版本兼容承诺保障**：签名和行为可能变化，服务或组件可能被重命名或移除，而无需升级主版本。请优先使用输入、输出、[公开 API](/zh/angular/api) 或上面的精选服务；只有高级集成才使用 `internals`，依赖它时请锁定精确版本。
:::

完整列表请参见 **[完整服务参考](/zh/angular/services-reference)** ，整体架构请参见[概览](/zh/angular/#internal-architecture-services-and-standalone-components)。
