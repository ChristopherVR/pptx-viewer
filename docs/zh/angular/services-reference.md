---
title: 完整服务参考
description: 组成 PowerPointViewerComponent 的全部内部服务、组件和辅助函数，以及从 pptx-angular-viewer 导入它们的方法。
---

# 完整服务参考 {#complete-services-reference}

这是[服务](/zh/angular/services)页面所引用的完整列表，按职责列出组成 `PowerPointViewerComponent` 的全部内部构建模块。如需了解受语义化版本兼容承诺保障的小范围公开 API，请参见[公开服务与组件](/zh/angular/services#public-services-components)。

::: warning 内部构建模块
以下所有内容都可以从 `pptx-angular-viewer/internals` 子路径导入。ng-packagr 将此包构建为单一编译单元，因此 `internals` 是同一产物的别名，这些符号也仍可从根入口导入。它们**不受语义化版本兼容承诺保障**：签名、行为乃至是否存在，都可能在不升级主版本的情况下变化。只有经过筛选的服务、输入、输出和[公开 API](/zh/angular/api) 无法满足需求时，才使用 `internals`。依赖它时请锁定精确版本。

```ts
import { AutosaveService, ViewerExportService } from 'pptx-angular-viewer/internals';
```

:::

## 编排服务 {#orchestration-services}

在 `PowerPointViewerComponent` 上提供（`providers: [...]`），通过 `inject()` 和各服务自身的 `bind()` 交接宿主访问器，完成接线。

| 服务                                | 职责                                                                |
| ----------------------------------- | ------------------------------------------------------------------- |
| `AutosaveService`                   | 定时自动保存调度和状态。                                            |
| `CanvasFitService`                  | 编辑器视口的适应宽度和画布尺寸计算。                                |
| `FieldContextService`               | 文本渲染的字段和占位符上下文，例如日期、幻灯片编号等。              |
| `InkDrawingService`                 | 绘图工具的自由墨迹笔画状态。                                        |
| `RulerGuidesService`                | 编辑器画布的标尺刻度和参考线状态。                                  |
| `SmartArt3DService`                 | 通过 `smartArt3D` 输入控制可选的 Three.js SmartArt 渲染器。         |
| `ViewerCanvasEditingService`        | 画布编辑编排，包括元素选择、变换、文本、墨迹和表格单元格编辑。      |
| `ViewerCollabCursorService`         | 跟踪本地指针，用于广播用户光标位置。                                |
| `ViewerCollaborationSessionService` | 共享和广播对话框状态，以及会话连接和断开的编排。                    |
| `ViewerCustomShowsService`          | 自定义放映状态，用于只放映部分幻灯片。                              |
| `ViewerDocumentPropertiesService`   | 文档信息对话框和超链接对话框状态。                                  |
| `ViewerExportService`               | PNG、PDF、GIF、视频导出和打印编排，包含进度和取消。                 |
| `ViewerFileIOService`               | “文件 > 打开 / 另存为”编排、内容覆盖和 `getContent()`。             |
| `ViewerFindReplaceService`          | 查找和替换栏状态，以及搜索和替换操作。                              |
| `ViewerFormatPainterService`        | 格式刷和吸管工具状态。                                              |
| `ViewerInspectorPanelService`       | 右侧检查器面板切换和移动端检查器可见性。                            |
| `ViewerKeyboardService`             | 文档级 keydown 监听器的键盘快捷键分发。                             |
| `ViewerMobileSheetService`          | 移动端底部面板状态（幻灯片、菜单、备注）和快速插入操作。            |
| `ViewerPresentationModeService`     | 放映模式编排，包括进入、退出、演示者视图和观众窗口。                |
| `ViewerThemeGalleryService`         | 主题库对话框状态和主题预设应用。                                    |
| `ViewerTouchGesturesService`        | 双指缩放、滑动导航和长按手势的接线逻辑。                            |
| `ViewerZoomService`                 | 缩放级别状态（zoom / zoomIn / zoomOut / zoomReset / zoomPercent）。 |
| `ZoomNavigationService`             | PowerPoint“缩放定位”（摘要缩放定位或节缩放定位）的导航目标。        |
| `ZoomTargetService`                 | 从当前文稿解析缩放定位磁贴的回退缩略图信息。                        |

## 编辑与元素基础功能 {#editing-element-primitives}

| 导出项                                                                                             | 职责                                                     |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `align-distribute` 的导出                                                                          | 水平或垂直对齐、分布选中的元素。                         |
| `editor-insert` 的导出 (`newTextElement`, `newShapeElement`, `newTableElement`, `newChartElement`) | 新插入元素的工厂函数。                                   |
| `group-ops` 的导出                                                                                 | 组合或取消组合选中的元素。                               |
| `template-mode` 的导出 (`buildSaveSlides`, ...)                                                    | 将分离的母版和布局模板元素合并回幻灯片，用于保存和导出。 |
| `inspector-helpers` 的导出                                                                         | 属性面板处理选中元素属性变化的辅助函数。                 |
| `text-advanced-helpers` 的导出                                                                     | 高级文本格式辅助函数，包括间距、分栏等。                 |
| `effects-helpers` 的导出                                                                           | 阴影、发光和倒影效果的样式辅助函数。                     |
| `gradient-picker-helpers` 的导出                                                                   | 渐变选择器中编辑渐变色标的辅助函数。                     |
| `selection-geometry` 的导出                                                                        | 选区框和操作控点的几何计算。                             |
| `snap-guides` 的导出                                                                               | 网格吸附和形状吸附参考线计算。                           |

## 图表内部接口 {#chart-internals}

为经过筛选的 `chart-*-options` 组件提供支持，参见[公开服务](/zh/angular/services)。

| 导出项                          | 职责                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `chart-advanced-helpers` 的导出 | 高级图表配置辅助函数。                                                                         |
| `chart-combo-stock` 的导出      | 组合图和股价图类型辅助函数。                                                                   |
| `chart-data-helpers` 的导出     | 图表系列和分类数据编辑辅助函数。                                                               |
| `chart-editor-styles` 的导出    | 图表编辑器面板共享的样式常量。                                                                 |
| `chart-event-helpers` 的导出    | 图表交互和事件辅助函数。                                                                       |
| `chart-overlays` 的导出         | 图表叠加内容的渲染辅助函数，包括数据标签、趋势线和误差线。                                     |
| `chart-renderer-helpers` 的导出 | 图表视图模型辅助函数，是 `pptx-viewer-shared` 的轻量适配层，包含图表调色板 `DEFAULT_PALETTE`。 |
| `chart-surface-treemap` 的导出  | 曲面图和树状图布局辅助函数。                                                                   |
| `chart-waterfall-map` 的导出    | 瀑布图和地图布局辅助函数。                                                                     |

## SmartArt 内部接口 {#smartart-internals}

二维创作辅助函数和可选的三维渲染器，为经过筛选的 `SmartArtRendererComponent` 提供支持。

| 导出项                                                                                                                                                                                       | 职责                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SmartArt3DRendererComponent`                                                                                                                                                                | 在 WebGL 中将 SmartArt 图形渲染为拉伸的三维块，通过 `smartArt3D` 按需启用。                                                                                                               |
| `SmartArtPreviewComponent`                                                                                                                                                                   | 实时渲染 SmartArt 布局预设，用于库预览。                                                                                                                                                  |
| `SmartArtPropertiesComponent`                                                                                                                                                                | SmartArt 专用检查器面板。                                                                                                                                                                 |
| `SMARTART_PALETTES`, `SMARTART_DEFAULT_PALETTE`, `smartArtPaletteColour`, `resolveSmartArtPalette`, `buildChromeStyle`, `computeDrawingViewBox`, `projectDrawingShapes`, `styleShadowFilter` | 绘图形状视图模型辅助函数，包括调色板、界面、viewBox 和 `RenderedShape` 投影。这里使用 `SmartArt` / `SMARTART_` 前缀别名，因为原名称与图表调色板中的同名符号冲突，参见上面的图表内部接口。 |
| `smart-art-inline-edit` 的导出                                                                                                                                                               | 在画布上内联编辑 SmartArt 文本和节点。                                                                                                                                                    |
| `smart-art-insert-helpers` 的导出 (`buildSmartArtInsertElement`)                                                                                                                             | 根据选定预设和各项文本构建新的 SmartArt 元素。                                                                                                                                            |
| `smart-art-node-style-helpers` 的导出                                                                                                                                                        | 逐节点样式解析辅助函数。                                                                                                                                                                  |
| `smart-art-properties-helpers` 的导出                                                                                                                                                        | 为 `SmartArtPropertiesComponent` 提供支持的辅助函数。                                                                                                                                     |
| `smart-art-renderer-helpers` 的导出                                                                                                                                                          | 为精选组件 `SmartArtRendererComponent` 提供支持的辅助函数。                                                                                                                               |

## 表格内部接口 {#table-internals}

| 导出项                            | 职责                                                     |
| --------------------------------- | -------------------------------------------------------- |
| `table-cell-style` 的导出         | 表格单元格样式解析。                                     |
| `table-data-helpers` 的导出       | 表格行、列和单元格数据编辑辅助函数。                     |
| `table-properties-helpers` 的导出 | 为 `TablePropertiesComponent` 提供支持的辅助函数。       |
| `table-renderer-helpers` 的导出   | 为精选组件 `TableRendererComponent` 提供支持的辅助函数。 |

## 功能区（工具栏子分区） {#ribbon-toolbar-sub-sections}

由 `RibbonComponent` 组合，而 `RibbonComponent` 又由 `PowerPointViewerComponent` 组合。

| 组件                                                              | 职责                                               |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| `RibbonComponent`                                                 | 完整的选项卡式功能区，组合下面所有分区。           |
| `RibbonPrimaryRowComponent`                                       | 分区内容上方的选项卡栏。                           |
| `RibbonHomeSectionComponent`                                      | 开始选项卡：剪贴板、字体和段落控件。               |
| `RibbonInsertSectionComponent`, `RibbonInsertFieldsComponent`     | 插入选项卡：形状、表格、图表、SmartArt 和字段。    |
| `RibbonDrawSectionComponent`, `RibbonDrawingGroupComponent`       | 绘图选项卡：自由墨迹工具。                         |
| `RibbonDesignSectionComponent`                                    | 设计选项卡：主题库入口。                           |
| `RibbonTransitionsSectionComponent`                               | 切换选项卡。                                       |
| `RibbonAnimationsSectionComponent`                                | 动画选项卡。                                       |
| `RibbonSlideshowSectionComponent`                                 | 幻灯片放映选项卡：放映、演示者视图和自定义放映。   |
| `RibbonReviewSectionComponent`                                    | 审阅选项卡：拼写检查和无障碍。                     |
| `RibbonViewSectionComponent`                                      | 视图选项卡：网格、标尺、参考线、吸附和幻灯片浏览。 |
| `RibbonArrangeSectionComponent`                                   | 排列选项卡：对齐、分布、组合和顺序。               |
| `RibbonEditingSectionComponent`                                   | 编辑选项卡控件，提供查找和替换入口。               |
| `RibbonFileSectionComponent`                                      | 文件选项卡：打开和保存操作。                       |
| `RibbonFontControlsComponent`, `RibbonParagraphControlsComponent` | 跨分区复用的共享字体和段落控件组。                 |
| `RibbonColorPopoverComponent`                                     | 跨分区复用的共享色板弹出层。                       |
| `ribbon-text-helpers` 的导出 (`patchTextStyle`)                   | 将文本样式补丁应用到选中元素。                     |

## 放映、导航与触控内部接口 {#presentation-navigation-touch-internals}

| 导出项                                 | 职责                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| `presentation-fullscreen` 的导出       | 放映模式的 Fullscreen API 包装。                           |
| `presentation-overlay-helpers` 的导出  | 为 `PresentationOverlayComponent` 提供支持的辅助函数。     |
| `presentation-subtitle-helpers` 的导出 | 为 `PresentationSubtitleBarComponent` 提供支持的辅助函数。 |
| `touch-gestures` 的导出                | 识别双指缩放、平移和点击手势。                             |
| `swipe-dismiss` 的导出                 | 移动端面板或抽屉的滑动关闭。                               |
| `ruler-ticks` 的导出                   | 标尺刻度计算。                                             |
| `zoom-renderer-helpers` 的导出         | 为精选组件 `ZoomRendererComponent` 提供支持的辅助函数。    |
| `shortcut-reference` 的导出            | 为 `ShortcutPanelComponent` 提供键盘快捷键速查表数据。     |

### 幻灯片过渡辅助函数 {#slide-transition-helpers}

`pptx-viewer-shared`（所有绑定共用的框架无关逻辑）是一个私有的、未发布的工作区包，因此搭建自己放映舞台的宿主无法直接 `import` 它。与本页其余内容不同，以下符号是通过精选的 `pptx-angular-viewer` 根入口（`viewer/index.ts`）从 `transition-helpers.ts` 导出的，而不只是 `internals`：ng-packagr 会把这个库编译成单一入口文件，因此 `pptx-angular-viewer/internals` 与根入口是完全相同的构建产物（参见 `src/internals.ts` 自身的头部注释），两者都能解析到下列同名符号。

| 导出项                                                                                                                            | 职责                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveSlideTransition` / `resolveTransitionDurationMs`                                                                          | 将 `PptxSlideTransition` 解析为 CSS `animation` 简写属性，以及计算其有效时长（毫秒）。                                                                                       |
| `getSlideTransitionAnimations` / `getCinematicTransitionAnimations` / `getP14TransitionAnimations`                                | 分别对应经典过渡系列、Office 2013+ 影院级过渡系列和 Office 2010 特效/三维过渡系列的解析函数。                                                                                |
| `SLIDE_TRANSITION_KEYFRAMES` / `SLIDE_TRANSITION_KEYFRAMES_CSS`、`CINEMATIC_TRANSITION_KEYFRAMES`、`P14_TRANSITION_KEYFRAMES_ALL` | 解析出的动画名称所引用的 `@keyframes` 代码块。                                                                                                                               |
| `resolveDirection` / `resolveDirection8` / `resolveOrientation` / `resolveWheelSpokeCount`                                        | 将 OOXML 的 `dir` / `orient` / `spokes` 取值归一化。                                                                                                                         |
| `RANDOM_ELIGIBLE_TYPES`、`INSTANT`、`DEFAULT_MORPH_DURATION_MS`、`TRANSITION_SPEED_DURATION_MS`、`EASE`、`WHEEL_SPOKE_COUNTS`     | 上述解析函数使用的辅助常量。                                                                                                                                                 |
| `SHARED_DEFAULT_TRANSITION_DURATION_MS`                                                                                           | 与 React/Vue 保持一致的共享默认值 1000 毫秒，改用别名是因为 Angular 自己的 `DEFAULT_TRANSITION_DURATION_MS`（取整为 320 毫秒）是一个独立的、已公开的常量，为向后兼容而保留。 |
| `PresentationTransitionOverlayComponent`                                                                                          | 放映模式过渡叠加层组件本身。                                                                                                                                                 |

## 协作内部接口 {#collaboration-internals}

`CollaborationService` 背后的完整内部接口。精选公开接口请参见[实时协作](/zh/angular/collaboration)。

| 导出项                                                                           | 职责                                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `collaboration-local-presence` 的导出 (`LocalPresencePublisher`)                 | 将本地用户的光标、选区和当前幻灯片发布到 Yjs awareness。   |
| `collaboration-providers` 的导出 (`createWebsocketBundle`, `createWebrtcBundle`) | 为每种传输方式构建 Yjs 文档、提供程序和 awareness 的组合。 |
| `collaboration-writeback` 的导出 (`WriteBackScheduler`)                          | 由选定写入者执行带防抖的 PPTX 快照回写。                   |

## 媒体、墨迹、OLE、三维模型与颜色辅助内部接口 {#media-ink-ole-3d-model-color-helper-internals}

| 导出项                               | 职责                                                       |
| ------------------------------------ | ---------------------------------------------------------- |
| `ink-drawing-helpers` 的导出         | 为 `InkDrawingService` 提供支持的纯辅助函数。              |
| `ink-renderer-helpers` 的导出        | 为精选组件 `InkRendererComponent` 提供支持的辅助函数。     |
| `MediaRendererComponent`             | 渲染音频和视频媒体元素。                                   |
| `media-renderer-helpers` 的导出      | 为 `MediaRendererComponent` 提供支持的辅助函数。           |
| `model3d-renderer-helpers` 的导出    | 为精选组件 `Model3DRendererComponent` 提供支持的辅助函数。 |
| `ole-renderer-helpers` 的导出        | 为精选组件 `OleRendererComponent` 提供支持的辅助函数。     |
| `ColorChangedImageComponent`         | 渲染应用了双色调或重新着色滤镜的图片。                     |
| `color-changed-image-helpers` 的导出 | 为 `ColorChangedImageComponent` 提供支持的辅助函数。       |
| `eyedropper` 的导出                  | 使用屏幕吸管 `EyeDropper` API 的取色辅助函数。             |

## 移动端界面内部接口 {#mobile-chrome-internals}

| 导出项                         | 职责                                       |
| ------------------------------ | ------------------------------------------ |
| `mobile-chrome-helpers` 的导出 | 移动端工具栏、底部栏和面板共享的辅助函数。 |

## 附属组件与辅助函数 {#ancillary-components-helpers}

不属于经过筛选的根入口导出，但由 `PowerPointViewerComponent` 直接组合使用。

| 导出项                                                  | 职责                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `CustomShowsComponent`, `custom-shows-helpers` 的导出   | 创建、重命名和删除自定义放映的对话框。                         |
| `ExportProgressModalComponent`                          | 导出 PDF、GIF 或视频时显示的进度弹窗。                         |
| `FollowModeBarComponent`                                | “跟随演示者”模式横幅。                                         |
| `InsertSmartArtDialogComponent`, `SmartArtInsertEvent`  | “插入 > SmartArt”图形库对话框。                                |
| `NotesToolbarComponent`                                 | 演讲者备注面板工具栏。                                         |
| `RemoteSelectionOverlayComponent`                       | 渲染远程用户的元素选区高亮。                                   |
| `SelectionPaneComponent`                                | 选择窗格（排列选项卡），用于列出元素和切换其状态。             |
| `ThemeGalleryComponent`, `theme-gallery-presets` 的导出 | 设计选项卡的主题库对话框及其预设数据。                         |
| `TitleBarComponent`                                     | 顶部标题栏，包括保存状态、撤销与重做、自动保存开关和命令搜索。 |
| `slide-canvas-helpers` 的导出                           | 为精选组件 `SlideCanvasComponent` 提供支持的辅助函数。         |
| `slide-sorter-overlay-helpers` 的导出                   | 为精选组件 `SlideSorterOverlayComponent` 提供支持的辅助函数。  |
| `animation-author-helpers` 的导出                       | 为 `AnimationAuthorPanelComponent` 提供支持的辅助函数。        |

此列表根据 `packages/angular/src/viewer/**/*.ts` 整理，所有内容均由 [`pptx-angular-viewer/src/internals.ts`](https://github.com/ChristopherVR/pptx-viewer/blob/main/packages/angular/src/internals.ts) 完整重新导出，再通过 `public-api.ts` 从包根入口重新导出。在其中新增或重命名构建模块时，请在同一变更中更新本页。
