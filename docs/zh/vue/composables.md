---
title: 组合式函数
description: PowerPointViewer 的组合式函数架构、pptx-vue-viewer/viewer 导出的公开组合式函数，以及 pptx-vue-viewer/internals 提供的完整内部接口。
---

# 组合式函数 {#composables}

`PowerPointViewer.vue` 是一个轻量的 `<script setup>` 编排层。绝大部分逻辑位于 `viewer/composables/` 下的 **110 多个自定义组合式函数**中，并在组件内组合使用，而可视组件主要负责展示。状态完全由 Vue 响应式系统管理，不使用外部状态库。

::: info 公开接口与内部接口
多数此类组合式函数属于**内部架构**，依赖特定的组合顺序和共享输入。经过筛选的一小部分通过 `pptx-vue-viewer/viewer` 导出，具有常规的语义化版本兼容承诺。**完整**接口也可以从 `pptx-vue-viewer/internals` 导入，但这些内部构建模块不受语义化版本兼容承诺保障，因此应优先使用稳定的根入口导出。参见[完整组合式函数参考](/zh/vue/composables-reference)。
:::

## 内部架构 {#architecture-internal}

这些组合式函数说明了查看器的组装方式。它们可以导入（见下文），但依赖特定的组合顺序和共享输入。此表用于理解架构，并非 API 兼容性约定。

| 组合式函数                  | 职责                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `useLoadContent`            | 加载时通过 `PptxHandler` 解析 PPTX 缓冲区。                                   |
| `useEditorHistory`          | 撤销和重做快照栈，支持模板元素层（母版和布局）。                              |
| `useEditorOperations`       | 元素创建、更新、删除和复制的基础操作。                                        |
| `useElementDrag`            | 移动、缩放、旋转和调整，以及吸附和对齐参考线。                                |
| `useElementInsertion`       | 插入形状、图片、文本框、表格和图表。                                          |
| `useSlideOperations`        | 添加、删除、复制和重排幻灯片。                                                |
| `useAutosave`               | 带防抖的自动保存定时器和状态，参见[属性 > 自动保存](/zh/vue/props#autosave)。 |
| `usePresentationModeWiring` | 将幻灯片放映导航接入组件。                                                    |
| `useExportWiring`           | 将 PNG / PDF / GIF / WebM 导出和打印接入组件。                                |
| `useCollaborationWiring`    | 共享或广播对话框，以及由属性驱动的 Yjs 会话生命周期。                         |
| `useRibbonProps`            | 组装完整的 Office 风格功能区 `RibbonProps` 接口。                             |
| `useEditorKeyboard`         | 由配置驱动的键盘快捷键注册和分发。                                            |
| `useIsMobile`               | 判断设备、视口、手机、平板和方向。                                            |

此外还有数十个组合式函数，负责对话框、批注、节、SmartArt 编辑、表格编辑、放映子逻辑、移动端界面等。按职责分组的完整列表请参见 **[完整组合式函数参考](/zh/vue/composables-reference)** 。

## 公开组合式函数 {#public-composables}

以下接口由 `pptx-vue-viewer/viewer` 导出，可作为稳定 API 导入。它们按需使用，支持 tree-shaking。根入口 `pptx-vue-viewer` 重新导出协作组合式函数（`useCollaboration`、`useYjsProvider`、`usePresenceTracking`、`useCollaborativeState` 和 `useCollaborativeHistory`）；完整的精选公开接口位于 `/viewer` 子路径。

```ts
import {
	useCollaboration,
	useEditorHistory,
	useEditorOperations,
	useLoadContent,
} from 'pptx-vue-viewer/viewer';
```

### `useLoadContent` {#useloadcontent}

通过 `PptxHandler` 解析 `.pptx` 缓冲区，并以响应式状态暴露结果。输入类型为 `MaybeRefOrGetter`，因此普通值、`ref` 和 getter 均可使用；输入变化时会重新加载。

```ts
function useLoadContent(
	content: MaybeRefOrGetter<Uint8Array | ArrayBuffer | null | undefined>,
): UseLoadContentResult;
```

`UseLoadContentResult` 提供以下响应式字段：`slides`、`templateElementsBySlideId`、`canvasSize`、`theme`、`themeColorMap`、`slideMasters`、`layoutOptions`、`mediaDataUrls`、`loading`、`error`、`isEncrypted`、`handler`（用于保存的活动 `PptxHandler`），以及文档元数据，包括 `coreProperties`、`appProperties`、`customProperties`、`sections`、`customShows`、`embeddedFonts`、`signatures` 等。

```vue
<script setup lang="ts">
import { useLoadContent } from 'pptx-vue-viewer/viewer';

const props = defineProps<{ bytes: ArrayBuffer | null }>();

const { slides, canvasSize, loading, error, handler } = useLoadContent(() => props.bytes);

async function save(): Promise<Uint8Array | undefined> {
	return handler.value?.save([...slides.value]);
}
</script>

<template>
	<p v-if="loading">Parsing...</p>
	<p v-else-if="error">{{ error }}</p>
	<p v-else>{{ slides.length }} slides at {{ canvasSize.width }}x{{ canvasSize.height }}</p>
</template>
```

### `useEditorHistory` 与 `useEditorOperations` {#useeditorhistory-and-useeditoroperations}

两者可以组成最小的无界面编辑器。`useEditorHistory(slides)` 管理撤销和重做快照栈；`useEditorOperations` 提供元素增删改操作，并通过该快照栈记录历史。

```ts
function useEditorHistory(
	slides: Ref<PptxSlide[]>,
	templateElementsBySlideId?: Ref<TemplateElementMap>,
): {
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	pushHistory: () => void; // call immediately BEFORE committing a mutation
	undo: () => void;
	redo: () => void;
	clearHistory: () => void;
};

function useEditorOperations(input: {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	pushHistory: () => void;
	selectedElementIds?: Ref<string[]>;
	templateElementsBySlideId?: Ref<TemplateElementMap>;
}): EditorOperations;
```

`EditorOperations` 包含 `activeSlide`、`selectedElementIds`、`addElement`、`updateElement`、`removeElement`、`transformElement` / `moveElement`、`duplicateElement`、`bringForward`、`sendBackward`、`reorder` 和 `updateElementText`。

```ts
import { ref } from 'vue';
import { useEditorHistory, useEditorOperations, useLoadContent } from 'pptx-vue-viewer/viewer';

const { slides } = useLoadContent(() => props.bytes);
const activeSlideIndex = ref(0);

const history = useEditorHistory(slides);
const ops = useEditorOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});

ops.updateElementText('el_12', 'Updated headline');
ops.transformElement('el_12', { x: 120, y: 80 });
history.undo(); // reverts both, most recent first
```

::: tip 快照顺序
`pushHistory()` 保存的是**当前**状态，因此必须在提交修改之前运行。`useEditorOperations` 返回的操作会自动处理此顺序；只有自行修改 `slides` 时才需要手动调用 `pushHistory`。
:::

### `useCollaboration` {#usecollaboration}

`useCollaboration` 可以在不使用查看器组件的情况下管理 Yjs 会话、在线状态、光标和选定写入者同步。完整说明请参见[实时协作](/zh/vue/collaboration)。

```ts
function useCollaboration(options: {
	slides: Ref<PptxSlide[]>;
	onRemoteSlides: (slides: PptxSlide[]) => void;
	userColor?: string;
	canvasWidth?: Ref<number> | number;
	canvasHeight?: Ref<number> | number;
	getSourceBytes?: () => Uint8Array | null;
	getTemplateElements?: () => Record<string, PptxElement[]>;
}): UseCollaborationResult;
```

返回结果包括响应式的 `status`、`connected`、`cursors`、`remotePresences`、`connectedCount`、`followedSlideIndex`、`broadcasterSlideIndex`，以及命令式方法 `start(config)`、`stop()`、`retry()`、`setCursor(x, y)`、`setSelection(ids)`、`setActiveSlide(index)` 和 `followUser(clientId)`。

```ts
const collab = useCollaboration({
	slides,
	onRemoteSlides: (next) => (slides.value = next),
});

await collab.start({
	roomId: 'deck-42',
	serverUrl: 'wss://collab.example.com',
	userName: 'Ada',
});
```

组件的共享和广播对话框生命周期由内部 `useCollaborationWiring` 组合式函数接入。它可以从 `pptx-vue-viewer/internals` 导入，不属于稳定的根入口或 `/viewer` 入口。

### 辅助函数 {#helper-functions}

除组合式函数外，`pptx-vue-viewer/viewer` 还导出渲染组件使用的纯辅助函数：`getContainerStyle`、`getShapeFillStrokeStyle`、`getTextBlockStyle`、`getImageSrc`、`getResolvedShapeClipPath`、`getResolvedShapeClipPathFor`、`collectMediaElements`、`collectImagePaths`、`buildInitialGuides`，以及观众与演示者内容共享辅助函数（`isAudienceTab`、`storeAudienceContent`、`loadAudienceContent`、`clearAudienceContent`）和 `useToolbarVisibility`。

稳定入口还导出 `CollaborationCursors`、`CollaborationStatusIndicator`、`RemoteSelectionOverlay` 和 `FollowModeBar`，用于自定义在线状态界面。参见[实时协作](/zh/vue/collaboration)。

## 直接使用内部组合式函数 {#using-an-internal-composable-directly}

如果上面的精选公开组合式函数无法满足需求，也可以从 `pptx-vue-viewer/internals` 导入全部内部组合式函数：

```ts
import { useAlignGroup, useAutosave } from 'pptx-vue-viewer/internals';
```

::: warning 内部构建模块
`pptx-vue-viewer/internals` 原样重新导出 `PowerPointViewer.vue` 内部组合使用的函数，包括直接使用和子组件通过接线组合式函数使用的接口。它们**不受语义化版本兼容承诺保障**：签名和行为可能变化，组合式函数可能被重命名或移除，而无需升级主版本。请优先使用属性和 `defineExpose` API，或经过筛选的 `pptx-vue-viewer/viewer` 组合式函数；只有高级集成才使用 `internals`，依赖它时请锁定精确版本。
:::

完整列表请参见 **[完整组合式函数参考](/zh/vue/composables-reference)** ，整体架构请参见[概览](/zh/vue/#composables-based-architecture)。
