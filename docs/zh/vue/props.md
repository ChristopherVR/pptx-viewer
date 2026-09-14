---
title: 组件属性
description: PowerPointViewerProps 和 PowerPointViewerEmits 完整参考，涵盖 PowerPointViewer 组件的内容、编辑、主题、自动保存及协作属性与事件。
---

# 组件属性 {#component-props}

自定义宿主尺寸时，请参阅[视口适配](/zh/guide/viewport-fit)，了解 `fitPadding`、`maxFitScale`、各框架示例和默认值。

`<PowerPointViewer>` 接受下面的 `PowerPointViewerProps` 接口，并发出 `PowerPointViewerEmits` 中定义的事件。只有 `content` 是必填项，其余均可选。此参考直接依据 `packages/vue/src/viewer/types.ts` 整理。

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { PowerPointViewerProps } from 'pptx-vue-viewer';
</script>
```

::: tip 提示
`PowerPointViewer` 还提供模板 ref 接口，参见 [`defineExpose`](/zh/vue/handle)，它不属于 `PowerPointViewerProps`。
:::

## 内容 {#content}

| 属性       | 类型                        | 默认值 | 说明                                                                          |
| ---------- | --------------------------- | ------ | ----------------------------------------------------------------------------- |
| `content`  | `Uint8Array \| ArrayBuffer` | 必填   | 原始 `.pptx` 文件字节。                                                       |
| `filePath` | `string`                    | -      | 原始文件路径或名称，用作文档版本历史标签的上下文。参见[自动保存](#autosave)。 |
| `fileName` | `string`                    | -      | 打开文档的显示名称，出现在标题栏中。                                          |

## 编辑 {#editing}

| 属性      | 类型      | 默认值  | 说明                                                                        |
| --------- | --------- | ------- | --------------------------------------------------------------------------- |
| `canEdit` | `boolean` | `false` | 启用工具栏编辑、属性面板编辑、行内文本编辑和幻灯片管理。为 `false` 时只读。 |

## 事件 {#events}

| 事件                   | 载荷                          | 说明                                                                    |
| ---------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `@dirty-change`        | `isDirty: boolean`            | 未保存修改标记变化时触发。                                              |
| `@content-change`      | `content: Uint8Array`         | 内容变化时触发，携带重新序列化的文档字节。                              |
| `@autosave`            | `content: Uint8Array`         | 每个自动保存周期触发，携带重新序列化的字节，参见[自动保存](#autosave)。 |
| `@active-slide-change` | `slideIndex: number`          | 当前幻灯片变化时触发。                                                  |
| `@zoom-change`         | `zoom: number`                | 缩放级别变化时触发。                                                    |
| `@slide-count-change`  | `count: number`               | 幻灯片总数变化时触发，例如添加或删除幻灯片。                            |
| `@selection-change`    | `elementIds: string[]`        | 元素选区变化时触发。                                                    |
| `@mode-change`         | `mode: string`                | 查看器模式变化时触发，例如从编辑切换到放映。                            |
| `@start-collaboration` | `config: CollaborationConfig` | 用户从共享对话框启动会话时触发。                                        |
| `@stop-collaboration`  | -                             | 用户从共享对话框停止会话时触发。                                        |

在底层 `PowerPointViewerEmits` 类型中，`content` 和 `autosave` 共用一个签名，载荷为 `Uint8Array`；`active-slide-change`、`zoom-change` 和 `slide-count-change` 也共用一个签名，载荷均为 `number`。

::: info 没有 `onOpenFile` 事件
“文件 > 打开”使用的是**属性**而非事件：`onOpenFile?: () => void`（见下文）。它与 React 的回调属性形式一致，不采用该组件其他位置使用的 emit 约定。
:::

## 展示与创作 {#presentation-authoring}

| 属性                                                                       | 类型           | 默认值  | 说明                                                                                                          |
| -------------------------------------------------------------------------- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `authorName`                                                               | `string`       | -       | 批注和标记的作者显示名称。协作时回退到 `collaboration.userName`，否则回退到 `'You'`。                         |
| `class`                                                                    | `string`       | -       | 应用于查看器根元素的可选类名，属性键为 `class`，不是 `className`。                                            |
| `smartArt3D`                                                               | `boolean`      | `false` | 启用基于 WebGL 的 Three.js SmartArt 挤出三维块渲染器，需要可选同级依赖 `three`，缺少时回退到 SVG。            |
| `surfaceChart3D`, `barChart3D`, `lineChart3D`, `areaChart3D`, `pieChart3D` | `boolean`      | `false` | 分别启用对应三维图表类型的交互式 Three.js 渲染器。缺少 `three`，或图表无法渲染为 WebGL 场景时，均回退为 SVG。 |
| `ai`                                                                       | `PptxAiConfig` | -       | 启用可选智能助手。SDK 同级依赖只在打开面板时加载，省略则不提供助手。                                          |
| `onOpenFile`                                                               | `() => void`   | -       | 由宿主接管“文件 > 打开”操作，绕过内置文件选择器，随后由宿主提供新的 `content` 属性。                          |

## 主题 {#theming}

| 属性    | 类型          | 默认值 | 说明                                                                                                                      |
| ------- | ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `theme` | `ViewerTheme` | -      | 主题配置，包括部分颜色覆盖、自定义 `radius` 和任意 `cssVars`。未设置的值回退为内置深色主题。参见[主题](/zh/vue/theming)。 |

```vue
<PowerPointViewer
	:content="bytes"
	:theme="{ colors: { primary: '#6366f1', background: '#0f172a' }, radius: '0.75rem' }"
/>
```

## 协作 {#collaboration}

这些属性用于启用和控制实时协同编辑。完整流程及 `CollaborationConfig` 结构请参见[实时协作](/zh/vue/collaboration)。

| 属性            | 类型                                                         | 默认值 | 说明                                                                                                               |
| --------------- | ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `collaboration` | `CollaborationConfig`                                        | -      | 提供后启用协同编辑，包括实时光标、在线状态和 Yjs CRDT 同步。需要 `yjs` 以及 `y-websocket` / `y-webrtc` peer 依赖。 |
| `shareDefaults` | `{ roomId?: string; userName?: string; serverUrl?: string }` | -      | 共享对话框字段的默认值，省略时为空。                                                                               |

通过上述 `@start-collaboration` / `@stop-collaboration` 事件控制会话启动和停止：宿主响应事件，设置或清空 `collaboration` 属性。

## 完整接口 {#full-interface}

```ts
interface PowerPointViewerProps {
	content: Uint8Array | ArrayBuffer;
	filePath?: string;
	fileName?: string;
	canEdit?: boolean;
	autosave?: boolean;
	autosaveIntervalMs?: number;
	class?: string;
	authorName?: string;
	theme?: ViewerTheme;
	collaboration?: CollaborationConfig;
	shareDefaults?: { roomId?: string; userName?: string; serverUrl?: string };
	onOpenFile?: () => void;
	smartArt3D?: boolean;
	surfaceChart3D?: boolean;
	barChart3D?: boolean;
	lineChart3D?: boolean;
	areaChart3D?: boolean;
	pieChart3D?: boolean;
	ai?: PptxAiConfig;
}

interface PowerPointViewerEmits {
	(e: 'dirty-change', isDirty: boolean): void;
	(e: 'content-change' | 'autosave', content: Uint8Array): void;
	(e: 'active-slide-change' | 'zoom-change' | 'slide-count-change', value: number): void;
	(e: 'mode-change', mode: string): void;
	(e: 'selection-change', elementIds: string[]): void;
	(e: 'start-collaboration', config: CollaborationConfig): void;
	(e: 'stop-collaboration'): void;
}
```

## 自动保存 {#autosave}

`pptx-vue-viewer` 对幻灯片变化进行防抖，将崩溃恢复快照写入共享 IndexedDB 存储，并通过 `@autosave` 将序列化后的字节交给宿主。

| 属性                 | 类型      | 默认值                | 说明                                                             |
| -------------------- | --------- | --------------------- | ---------------------------------------------------------------- |
| `autosave`           | `boolean` | `true`                | 用于恢复的自动保存，是标题栏开关可启用范围的策略上限，详见下文。 |
| `autosaveIntervalMs` | `number`  | “文件 > 选项”中的间隔 | 防抖时间窗口，单位为毫秒。显式值优先于用户的自动恢复设置。       |

### autosave 属性和自动保存开关，谁优先 {#autosave-policy}

**五种绑定**遵循相同规则，统一实现在共享决策函数 `resolveAutosaveActivation` 中：

> **`autosave` 属性决定策略上限，标题栏开关表达该范围内的用户偏好。**

| `autosave` | 运行行为                                     | 开关                         |
| ---------- | -------------------------------------------- | ---------------------------- |
| 省略       | 允许自动保存，由用户开关决定，默认**开启**。 | 可用。                       |
| `true`     | 与省略相同，宿主允许，由用户决定。           | 可用。                       |
| `false`    | 自动保存关闭，加载时也不会提供恢复提示。     | **不可操作**，状态不能切换。 |

用户偏好不能越过宿主策略，因此 `autosave: false` 也会移除开关，避免出现看似可操作却没有效果的控件。无论采用哪种方式，`canEdit` / `editable` 和 `filePath` 键都是必要条件。

保存频率同样遵循该规则：显式 `autosaveIntervalMs` 是宿主策略，会按给定值执行；省略时遵循用户的 **“文件 > 选项 > 保存 > 每隔 N 分钟保存自动恢复信息”** 设置，默认两分钟。

默认值为 `true`，因为默认关闭的崩溃恢复无法为用户提供保障。

### 恢复快照 {#recovering-a-snapshot}

文稿加载完成后，如果同一键下存在 24 小时内的快照，查看器会弹出 **“恢复未保存的更改？”** 对话框，提供恢复和放弃选项。恢复会加载快照字节；放弃会删除快照。如果当前标签页已经接收过该快照，例如宿主已通过 `restoreSessionDeck` 恢复，则不会再次提示。

```vue
<PowerPointViewer
	:content="bytes"
	can-edit
	autosave
	:autosave-interval-ms="5000"
	@autosave="persist"
/>
```

标题栏提供自动保存开关，用户可以在运行时关闭。关闭后停止后续保存，但不会丢弃已发出的内容。每个自动保存周期还会生成一个仅当前会话有效的内存版本历史快照（参见版本历史面板），它与 `@autosave` 载荷彼此独立。

::: info 持久化与恢复提示
每个自动保存周期也会将字节写入共享 IndexedDB 恢复存储，与 React、Angular、Svelte 和原生 JavaScript 使用同一存储。因此，“文件 > 打开”中的最近文件列表和“文件 > 账户”中的存储与隐私面板显示的都是真实数据。即使文稿有密码保护，快照也以普通 ZIP 存储，以便恢复时无需密码。

Vue 与其他绑定一样，也会在加载时显示“恢复未保存会话”的**提示**（`AutosaveRecoveryDialog`）。
:::
