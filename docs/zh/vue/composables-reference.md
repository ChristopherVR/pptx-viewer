---
title: 完整组合式函数参考
description: 组成 PowerPointViewer 的全部内部组合式函数，以及通过 pptx-vue-viewer/internals 导入它们的方法。
---

# 完整组合式函数参考 {#complete-composables-reference}

这是[组合式函数](/zh/vue/composables)页面所引用的完整列表，按职责列出在内部组成 `PowerPointViewer.vue` 的全部组合式函数，包括直接使用的函数，以及子组件通过接线组合式函数间接使用的函数。如需了解受语义化版本兼容承诺保障的小范围公开 API，请参见[公开组合式函数](/zh/vue/composables#public-composables)。

::: warning 内部构建模块
以下组合式函数都可以从 `pptx-vue-viewer/internals` 导入，但它们确实属于内部接口，不受语义化版本兼容承诺保障；签名、行为乃至是否存在，都可能在不升级主版本的情况下变化。只有经过筛选的 `pptx-vue-viewer/viewer` 导出以及公开属性和 `defineExpose` API 无法满足需求时，才应使用此入口。依赖它时请锁定精确版本。

```ts
import { useEditorHistory, useAlignGroup } from 'pptx-vue-viewer/internals';
```

:::

## 核心状态与生命周期 {#core-state-lifecycle}

| 组合式函数                    | 职责                                               |
| ----------------------------- | -------------------------------------------------- |
| `useLoadContent`              | 加载时通过 `PptxHandler` 解析 PPTX 缓冲区。        |
| `useAutosave`                 | 带防抖的自动保存定时器、未保存修改跟踪和状态。     |
| `useDocumentStatistics`       | 为文档属性对话框统计单词、字符、幻灯片和备注数量。 |
| `useDocumentPropertiesDialog` | 核心、自定义及应用文档属性的对话框状态。           |
| `useMasterViewState`          | 幻灯片、备注和讲义的母版视图状态。                 |
| `useViewerSettingsDialog`     | 查看器设置对话框状态，例如拼写检查、网格等。       |
| `useVersionHistory`           | 带名称、可恢复的内存幻灯片快照。                   |
| `useVersionHistoryWiring`     | 将版本历史和比较面板接入组件。                     |

## 编辑与历史记录 {#editing-history}

| 组合式函数             | 职责                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `useEditorHistory`     | 撤销和重做快照栈，支持模板元素层（母版和布局）。                       |
| `useEditorOperations`  | 元素创建、更新、删除和复制的基础操作。                                 |
| `useEditorKeyboard`    | 由配置驱动的键盘快捷键注册和分发。                                     |
| `useElementDrag`       | 移动、缩放、旋转和调整，以及吸附和对齐参考线。                         |
| `useElementInsertion`  | 插入形状、图片、文本框、表格和图表。                                   |
| `useMultiSelectOps`    | 对选区执行删除、复制、上移一层和下移一层。                             |
| `useAlignGroup`        | 对齐、分布、组合和取消组合。                                           |
| `useSlideOperations`   | 添加、删除、复制和重排幻灯片。                                         |
| `useSlideMutations`    | 修改幻灯片备注、隐藏标记、切换效果和动画。                             |
| `useSectionOperations` | 在幻灯片缩略图栏中创建、重命名、删除和重排节（分组）。                 |
| `useThemeEditing`      | 应用或编辑文档的 PowerPoint 主题及调色板。                             |
| `useFindReplace`       | 跨幻灯片文本查找替换。                                                 |
| `useFormatPainter`     | 从一个元素复制格式并应用到另一个元素。                                 |
| `useInlineEditing`     | 开始、提交和取消文本及表格单元格的内联编辑。                           |
| `useInkDrawing`        | 自由绘制和擦除墨迹笔画。                                               |
| `useChartEditing`      | 编辑图表坐标轴标题、网格线、标记和系列样式。                           |
| `useColorChangeImage`  | 编辑图片“重新着色”（`clrChange`）效果（`use-color-change-image.ts`）。 |
| `useModel3dScene`      | 交互式 GLB/GLTF 三维模型查看场景。                                     |

## SmartArt 编辑 {#smartart-editing}

| 组合式函数                   | 职责                                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| `useSmartArtEditing`         | 编辑 SmartArt 节点、布局、颜色和样式。                                 |
| `useSmartArtFocus`           | SmartArt 节点的键盘焦点和导航。                                        |
| `useSmartArtHoverRect`       | SmartArt 节点的悬停高亮矩形。                                          |
| `useSmartArtNodeEditContext` | 通过 provide/inject 为 SmartArt 节点的内联文本和填充编辑提供上下文。   |
| `useSmartArtInlineEditState` | SmartArt 内联节点编辑器的打开和关闭状态（`smartart-inline-edit.ts`）。 |
| `useSmartArt3D`              | 通过 inject 读取可选的 `smartArt3D` 标记（`smart-art-3d.ts`）。        |

## 表格 {#tables}

| 组合式函数                   | 职责                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `useTableCellEditingContext` | 通过 provide/inject 为表格单元格的内联文本编辑提供上下文。 |
| `useTableCellSelection`      | 表格单元格范围选择及行列尺寸调整（`table-selection.ts`）。 |

## 画布交互 {#canvas-interaction}

| 组合式函数             | 职责                                                           |
| ---------------------- | -------------------------------------------------------------- |
| `useContextMenu`       | 右键或长按触发的元素上下文菜单。                               |
| `useIsMobile`          | 判断设备、视口、手机、平板和方向。                             |
| `useTouchGestures`     | 双指缩放、平移和长按手势识别。                                 |
| `useKeyboardInsets`    | 根据移动端屏幕键盘调整布局。                                   |
| `useKeyboardShortcuts` | 快捷键目录、分组和匹配解析。                                   |
| `useSheetDismissDrag`  | 移动端底部抽屉滑动关闭。                                       |
| `useToolbarAutoHide`   | 鼠标空闲时自动隐藏悬浮放映工具栏。                             |
| `useDebouncedCallback` | 通用的防抖回调工具。                                           |
| `useSelection`         | 通用的响应式已选 ID 集合辅助函数，支持单选、追加、切换和清空。 |

## 功能区与工具栏 {#ribbon-toolbar}

| 组合式函数         | 职责                                                   |
| ------------------ | ------------------------------------------------------ |
| `useRibbonProps`   | 组装完整的 Office 风格功能区 `RibbonProps` 接口。      |
| `useRibbonActions` | 功能区操作处理器，包括文本样式、翻转、移至边缘和对齐。 |
| `useRibbonUiState` | 功能区展开、折叠、分区和绘图工具的界面状态。           |

## 导出、打印与 I/O {#export-print-i-o}

| 组合式函数          | 职责                                                |
| ------------------- | --------------------------------------------------- |
| `useExport`         | PNG / PDF 导出流程（`html2canvas-pro` + `jspdf`）。 |
| `useExportProgress` | 导出进度报告和取消。                                |
| `useExportWiring`   | 将导出、打印和媒体导出接入组件。                    |
| `useMediaExport`    | 将幻灯片导出为动态 GIF 和 WebM 视频。               |
| `usePrint`          | 打印对话框状态及栅格化后的打印窗口流程。            |

## 对话框 {#dialogs}

| 组合式函数                | 职责                                                      |
| ------------------------- | --------------------------------------------------------- |
| `useInsertElementDialogs` | 插入 SmartArt 或公式的对话框状态及编辑入口路由。          |
| `useHeaderFooterDialog`   | 页眉和页脚对话框状态。                                    |
| `usePasswordProtection`   | 密码保护对话框和演示文稿密码状态。                        |
| `useCustomShows`          | 自定义放映的创建、重命名和删除操作。                      |
| `useCustomShowsWiring`    | 将自定义放映接入组件。                                    |
| `useSlideShowSettings`    | 设置幻灯片放映对话框和字幕开关。                          |
| `useSignatures`           | 数字签名验证和总体状态。                                  |
| `useSignatureWorkflow`    | 签名面板及签名被移除警告的接线逻辑。                      |
| `useFontEmbedding`        | 字体嵌入对话框和已用字体族检测。                          |
| `useSelectionPaneWiring`  | “视图 > 选择窗格”的接线逻辑，包括选择、切换可见性和重排。 |

## 批注 {#comments}

| 组合式函数          | 职责                       |
| ------------------- | -------------------------- |
| `useComments`       | 批注讨论串状态和增删改查。 |
| `useCommentsWiring` | 将批注接入组件。           |

## 放映模式 {#presentation-mode}

| 组合式函数                   | 职责                                       |
| ---------------------------- | ------------------------------------------ |
| `usePresentationModeWiring`  | 接入组件的幻灯片放映导航，作为顶层组合器。 |
| `usePresentationAnnotations` | 放映时使用画笔、荧光笔和激光笔进行标注。   |
| `useRehearseTimings`         | 排练时记录各页时长。                       |

## 协作 {#collaboration}

由属性驱动的流程请参见[实时协作](/zh/vue/collaboration)。完整内部接口如下：

| 组合式函数               | 职责                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `useCollaboration`       | Yjs CRDT 会话生命周期，包括启动、停止、在线状态、光标和选定写入者的数据回写。 |
| `useCollaborationWiring` | 共享及广播对话框状态、由属性驱动的自动启动和停止，以及光标和选区发布。        |

## 无障碍 {#accessibility}

| 组合式函数         | 职责                                             |
| ------------------ | ------------------------------------------------ |
| `useAccessibility` | 无障碍检查器，检查替代文本、对比度、阅读顺序等。 |

此列表根据 `packages/vue/src/viewer/composables/**/*.ts` 中导出 `use*()` 组合式函数的文件整理，所有函数均由 [`pptx-vue-viewer/internals`](https://github.com/ChristopherVR/pptx-viewer/blob/main/packages/vue/src/internals.ts) 完整重新导出。只导出纯辅助函数、provide/inject 键或常量而没有 `use*()` 函数的文件属于内部实现细节，不在此接口范围内。新增或重命名组合式函数时，请在同一变更中更新本页。

::: info `RasterizeSlide`
`useExport`、`useMediaExport` 和 `usePrint` 各自声明了相同的 `RasterizeSlide` 类型（`(index: number) => Promise<HTMLCanvasElement>`）。为避免重新导出产生歧义，`pptx-vue-viewer/internals` 只重新导出 `useExport` 中的定义。如果需要通过这个确切名称使用其他模块中的类型，请直接从其源文件导入。
:::
