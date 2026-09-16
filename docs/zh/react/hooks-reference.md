---
title: 完整 Hooks 参考
description: 按职责列出组成 PowerPointViewer 的全部内部 hook，以及从 pptx-react-viewer/internals 导入的方式。
---

# 完整 Hooks 参考 {#complete-hooks-reference}

本页是 [Hooks](/zh/react/hooks) 引用的完整列表，按职责组织 `PowerPointViewer` 的内部 hooks。遵循语义化版本兼容保证的公共子集见[公共 hooks](/zh/react/hooks#public-hooks)。

::: warning 内部构建块
下列 hooks 均可从 `pptx-react-viewer/internals` 导入，但不受语义化版本兼容保证约束，签名、行为和是否存在都可能在不升级主版本的情况下改变。只有 `pptx-react-viewer/viewer` 的公共导出和组件的属性、句柄不能满足需求时才应使用，并锁定精确版本。

```tsx
import { useViewerState, useEditorHistory } from 'pptx-react-viewer/internals';
```

:::

## 核心状态与生命周期 {#core-state-lifecycle}

| Hook                     | 职责                                        |
| ------------------------ | ------------------------------------------- |
| `useViewerState`         | 组合核心和 UI 状态。                        |
| `useViewerCoreState`     | 幻灯片、选择、画布尺寸和模式。              |
| `useViewerUIState`       | 面板可见性、对话框和工具栏标记。            |
| `useDerivedSlideState`   | 计算可见索引、节和母版伪幻灯片。            |
| `useDerivedElementState` | 计算元素边界、控点和堆叠顺序等派生状态。    |
| `useContentLifecycle`    | 连接内容同步、未保存修改跟踪和恢复检测。    |
| `useLoadContent`         | 挂载时通过 `PptxHandler` 解析 PPTX 缓冲区。 |
| `useRecoveryDetection`   | 检测之前未保存的会话，提供恢复。            |
| `useAutosave`            | 定时自动保存调度和状态。                    |
| `useSerialize`           | 将当前文档序列化为字节。                    |
| `useViewerIntegration`   | 顶层整合 I/O、导出、打印、指针和生命周期。  |

## 编辑与历史记录 {#editing-history}

| Hook                         | 职责                                       |
| ---------------------------- | ------------------------------------------ |
| `useEditorHistory`           | 撤销重做快照栈，指针交互期间延迟捕获。     |
| `useEditorOperations`        | 组合全部编辑操作。                         |
| `useElementOperations`       | 元素创建、更新和删除的基础操作。           |
| `useElementManipulation`     | 移动、缩放、旋转和删除元素。               |
| `useSectionOperations`       | 创建、重命名和删除节。                     |
| `useTableOperations`         | 插入和删除行列，合并和拆分单元格。         |
| `useSlideManagement`         | 添加、删除、复制、重排和隐藏幻灯片。       |
| `useInsertElements`          | 插入形状、图片、文本框、表格和图表。       |
| `useGroupAlignLayerHandlers` | 组合、取消组合、对齐、分布和前后图层操作。 |
| `useMergeShapesHandler`      | 形状的联合、相减、相交和排除等布尔运算。   |
| `usePropertyHandlers`        | 选中元素的属性面板变更处理。               |
| `useThemeHandlers`           | 应用和切换文档的 PowerPoint 主题。         |
| `useThemeSwitching`          | 更高层的主题切换协调，也属于公共导出。     |
| `useLayoutSwitching`         | 切换幻灯片版式并重新映射占位符。           |
| `useClipboardHandlers`       | 元素复制、剪切和粘贴。                     |
| `useFindReplace`             | 跨幻灯片文本查找替换。                     |
| `useComments`                | 批注讨论串状态和增删改查。                 |
| `useAnnotationHandlers`      | 自由绘制和形状批注处理。                   |

## 画布交互 {#canvas-interaction}

| Hook                        | 职责                                |
| --------------------------- | ----------------------------------- |
| `usePointerHandlers`        | 画布鼠标和触控事件。                |
| `useCanvasInteractions`     | 选框、拖动选择和画布手势。          |
| `useZoomViewport`           | 缩放、适应宽度和视口 DOM ref。      |
| `useKeyboardShortcuts`      | 快捷键定义。                        |
| `useKeyboardShortcutWiring` | 将快捷键定义连接到 DOM 事件监听器。 |
| `useResizablePanels`        | 调整属性面板和侧边栏宽度。          |
| `useSheetDismissDrag`       | 移动端底部抽屉滑动关闭。            |
| `useModalDismissDrag`       | 移动端对话框滑动关闭。              |

## 导出、打印与 I/O {#export-print-i-o}

| Hook                                               | 职责                                   |
| -------------------------------------------------- | -------------------------------------- |
| `useExportHandlers`                                | PNG、SVG、PDF、GIF、视频和 PPTX 导出。 |
| `useExportSaveAs`                                  | 导出时的另存为文件选择流程。           |
| `usePrintHandlers`                                 | 打印对话框和布局。                     |
| `useIOHandlers`                                    | 打开和导入文件。                       |
| `useFontInjection`                                 | 将文稿嵌入字体注入页面。               |
| `useVirtualizedSlides`（含 `computeVirtualRange`） | 为大型文稿提供幻灯片面板和列表虚拟化。 |

## 对话框 {#dialogs}

| Hook                   | 职责                         |
| ---------------------- | ---------------------------- |
| `useViewerDialogs`     | 各模态对话框的开关状态。     |
| `useDialogCustomShows` | 特定对话框的自定义显示条件。 |

## 放映模式 {#presentation-mode}

| Hook                         | 职责                             |
| ---------------------------- | -------------------------------- |
| `usePresentationMode`        | 顶层组合放映导航、动画和切换。   |
| `usePresentationSetup`       | 进入放映时设置全屏和初始幻灯片。 |
| `usePresentationAnnotations` | 放映时的画笔和荧光笔批注。       |
| `useAnimationPlayback`       | 播放元素动画时间线。             |
| `useRehearsalTimings`        | 排练时记录各页时长。             |
| `usePresentationKeyboard`    | 放映期间的键盘导航。             |
| `useSlideNavigation`         | 上一页、下一页和跳转。           |
| `useZoomNavigation`          | 放映期间缩放和平移。             |
| `usePresenterWindow`         | 演讲者窗口与观众窗口消息通信。   |
| `useAudienceMode`            | 观众窗口的渲染模式。             |

## 幻灯片过渡辅助函数 {#slide-transition-helpers}

`pptx-viewer-shared`（所有绑定共用的框架无关逻辑）是一个私有的、未发布的工作区包：它从不发布到 npm，因此该 monorepo 之外的代码无法直接 `import` 它。如果宿主搭建了自己的放映舞台（自定义 `SlideStage`，而非完整的 `PowerPointViewer`），仍然需要用到过渡解析器和关键帧，因此这里把整套接口重新导出：

| 导出项                                                                                                                                                          | 职责                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `resolveSlideTransition`                                                                                                                                        | 将 `PptxSlideTransition` 解析为退出层/进入层的 CSS `animation` 简写属性。                     |
| `resolveTransitionDurationMs`                                                                                                                                   | 计算过渡的有效时长（毫秒），会考虑手动设置的时长、旧版 `spd` 取值和 PowerPoint 自身的默认值。 |
| `getSlideTransitionAnimations`                                                                                                                                  | `resolveSlideTransition` 内部调用的底层解析函数（经典二维过渡系列）。                         |
| `getCinematicTransitionAnimations` / `getP14TransitionAnimations`                                                                                               | 分别对应 Office 2013+（p15）影院级过渡系列和 Office 2010（p14）特效/三维过渡系列。            |
| `SLIDE_TRANSITION_KEYFRAMES`（别名 `SLIDE_TRANSITION_KEYFRAMES_CSS`）                                                                                           | 上述所有解析出的动画名称所引用的完整 `@keyframes` 代码块。只需通过 `<style>` 标签注入一次。   |
| `CINEMATIC_TRANSITION_KEYFRAMES` / `P14_TRANSITION_KEYFRAMES_ALL`                                                                                               | 已经并入 `SLIDE_TRANSITION_KEYFRAMES` 的关键帧子代码块；同时也单独导出。                      |
| `resolveDirection` / `resolveDirection8` / `resolveOrientation`                                                                                                 | 将 OOXML 的 `dir` / `orient` 取值归一化为已解析的方向/朝向。                                  |
| `resolveWheelSpokeCount`                                                                                                                                        | 将手动设置的 Wheel（车轮）辐条数吸附到 PowerPoint 提供的最接近取值。                          |
| `RANDOM_ELIGIBLE_TYPES`、`INSTANT`、`DEFAULT_TRANSITION_DURATION_MS`、`DEFAULT_MORPH_DURATION_MS`、`TRANSITION_SPEED_DURATION_MS`、`EASE`、`WHEEL_SPOKE_COUNTS` | 上述解析函数使用的辅助常量。                                                                  |
| `PresentationTransitionOverlay`、`MorphTransitionOverlay`、`SlideLayer`、`FragmentedTransitionLayer`                                                            | 放映模式过渡叠加层组件本身，供需要整个渲染叠加层（而不只是 CSS 解析结果）的宿主使用。         |

## 协作 {#collaboration}

公共子集见[协作](/zh/react/collaboration)，完整内部集合如下：

| Hook                      | 职责                                   |
| ------------------------- | -------------------------------------- |
| `useYjsProvider`          | 管理 Yjs WebSocket Provider 生命周期。 |
| `useYjsDocumentSync`      | 将 Yjs 文档同步到预览器状态。          |
| `usePresenceTracking`     | 跟踪远程光标、选择和连接状态。         |
| `useCollaborativeState`   | 基于 CRDT 的共享文档状态。             |
| `useCollaborativeHistory` | 协作撤销重做。                         |
| `useBroadcastFollower`    | 跟随其他用户广播的视口和选择。         |
| `useFollowMode`           | 协调跟随演讲者模式。                   |

## 移动端与响应式 {#mobile-responsive}

| Hook                 | 职责                                      |
| -------------------- | ----------------------------------------- |
| `useIsMobile`        | 判断设备、视口、手机、平板和方向。        |
| `useTouchGestures`   | 识别双指缩放、平移和点击手势。            |
| `useKeyboardInsets`  | 根据移动端屏幕键盘调整布局。              |
| `useSwipeNavigation` | 移动端滑动翻页。                          |
| `useReducedMotion`   | 动画和切换遵循 `prefers-reduced-motion`。 |

列表来自 `packages/react/src/viewer/hooks/**/*.ts`，全部从 [`pptx-react-viewer/internals`](https://github.com/ChristopherVR/pptx-viewer/blob/main/packages/react/src/internals.ts) 重新导出。在该目录新增或重命名 hook 时，请同步更新本页。
