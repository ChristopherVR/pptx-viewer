---
title: 组件输入与输出
description: PowerPointViewerComponent 的 @Input() 和 @Output() 完整参考，涵盖内容、编辑、事件、主题和协作。
---

# 组件输入与输出 {#component-inputs-outputs}

自定义宿主尺寸时，请参阅[视口适配](/zh/guide/viewport-fit)，了解 `fitPadding`、`maxFitScale`、各框架示例和默认值。

`PowerPointViewerComponent`（选择器为 `pptx-viewer`）通过基于信号的 `input()` 提供配置，通过 `output()` 发出事件。只读查看器只需要 `content`，其他配置均可选。此参考直接依据组件源码整理。

```ts
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
```

::: tip 提示
Angular 没有 `forwardRef` 句柄。`PowerPointViewerComponent` 的公开方法，包括导航、撤销与重做、缩放、`getContent()` 等，直接位于组件实例上，可以通过模板引用变量或 `viewChild()` 访问。参见[公开 API](/zh/angular/api)。
:::

## 内容 {#content}

| 输入       | 类型                                | 默认值 | 说明                                                                        |
| ---------- | ----------------------------------- | ------ | --------------------------------------------------------------------------- |
| `content`  | `Uint8Array \| ArrayBuffer \| null` | `null` | 原始 `.pptx` 文件字节。可直接接受类型化数组或 `ArrayBuffer`，无需手动包装。 |
| `filePath` | `string \| undefined`               | -      | 原始文件路径或名称，用作 IndexedDB 自动保存恢复的键，并显示在标题栏中。     |
| `fileName` | `string \| undefined`               | -      | 显示在标题栏保存位置状态旁的名称，回退为本地化的“演示文稿”。                |

::: tip 自动保存恢复需要 `filePath`
查看器内置的自动保存定时器会定期将文档序列化到 IndexedDB，以 `filePath` 为键。重新加载后若没有稳定的 `filePath`，就没有可供查找的恢复键。
:::

## 自动保存 {#autosave-policy}

| 输入                 | 类型                   | 默认值                | 说明                                                             |
| -------------------- | ---------------------- | --------------------- | ---------------------------------------------------------------- |
| `autosave`           | `boolean \| undefined` | `true`                | 用于恢复的自动保存，是标题栏开关可启用范围的策略上限，详见下文。 |
| `autosaveIntervalMs` | `number \| undefined`  | “文件 > 选项”中的间隔 | 恢复快照的保存间隔。显式值优先于用户的自动恢复设置。             |

**五种绑定**遵循相同规则，统一实现在共享决策函数 `resolveAutosaveActivation` 中：

> **`autosave` 输入是宿主策略上限，标题栏的自动保存开关是用户在此范围内的偏好。**

| `autosave` | 运行行为                                     | 开关                         |
| ---------- | -------------------------------------------- | ---------------------------- |
| 省略       | 允许自动保存，由用户开关决定，默认**开启**。 | 可用。                       |
| `true`     | 与省略相同，宿主允许，由用户决定。           | 可用。                       |
| `false`    | 自动保存关闭，加载时也不会提供恢复提示。     | **不可操作**，状态不能切换。 |

用户偏好不能越过宿主策略，因此 `autosave="false"` 也会移除开关。无论采用哪种方式，`canEdit` 和 `filePath` 键都是必要条件。显式 `autosaveIntervalMs` 优先于用户在 **“文件 > 选项 > 保存 > 每隔 N 分钟保存自动恢复信息”** 中设置的频率，默认两分钟。

文稿加载完成后，如果同一 `filePath` 下存在 24 小时内的快照，查看器会弹出 **“恢复未保存的更改？”** 对话框，提供恢复和放弃选项。

## 编辑 {#editing}

| 输入      | 类型      | 默认值  | 说明                                                                                       |
| --------- | --------- | ------- | ------------------------------------------------------------------------------------------ |
| `canEdit` | `boolean` | `false` | 启用编辑操作，包括功能区编辑工具、检查器编辑、内联文本编辑和幻灯片管理。`false` 表示只读。 |

## 事件（`@Output()`） {#events-output-s}

| 输出                 | 载荷                          | 说明                                                                                        |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `dirtyChange`        | `boolean`                     | 未保存修改标记切换时触发。                                                                  |
| `contentChange`      | `Uint8Array`                  | 每当 [`getContent()`](/zh/angular/api) 将文稿序列化为字节时触发，携带重新序列化的文档字节。 |
| `activeSlideChange`  | `number`                      | 当前幻灯片变化时触发。                                                                      |
| `modeChange`         | `string`                      | 查看器模式变化时触发，模式为 `'preview'`、`'edit'`、`'present'` 或 `'master'`。             |
| `zoomChange`         | `number`                      | 缩放级别变化时触发。                                                                        |
| `selectionChange`    | `string[]`                    | 元素选区变化时触发。                                                                        |
| `slideCountChange`   | `number`                      | 幻灯片总数变化时触发，例如添加或删除幻灯片。                                                |
| `propertiesChange`   | `Partial<PptxCoreProperties>` | 用户在信息对话框中编辑文档属性（标题、作者等）时触发。                                      |
| `startCollaboration` | `CollaborationConfig`         | 从共享或广播对话框启动会话时触发，请据此设置 `collaboration` 输入。                         |
| `stopCollaboration`  | `void`                        | 从共享或广播对话框停止会话时触发，请据此清空 `collaboration` 输入。                         |

::: info 说明
`contentChange` 提供的是 `Uint8Array`，不是布尔值。需要按需拉取内容时，请调用组件实例上的 [`getContent()`](/zh/angular/api)。
:::

## 展示与创作 {#presentation-authoring}

| 输入                                                                       | 类型                        | 默认值  | 说明                                                                                                          |
| -------------------------------------------------------------------------- | --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `authorName`                                                               | `string \| undefined`       | -       | 用于批注和标注作者、以及广播所有者的显示名称，回退为 `collaboration.userName` 或 `'You'` / `'Presenter'`。    |
| `class`                                                                    | `string`                    | `''`    | 应用于查看器根元素的可选类名。                                                                                |
| `smartArt3D`                                                               | `boolean`                   | `false` | 启用基于 WebGL 的 Three.js SmartArt 挤出三维块渲染器，需要可选同级依赖 `three`，缺少时回退到 SVG。            |
| `surfaceChart3D`, `barChart3D`, `lineChart3D`, `areaChart3D`, `pieChart3D` | `boolean`                   | `false` | 分别启用对应三维图表类型的交互式 Three.js 渲染器。缺少 `three`，或图表无法渲染为 WebGL 场景时，均回退为 SVG。 |
| `ai`                                                                       | `PptxAiConfig`              | -       | 启用可选的 AI 助手，其 SDK peer 依赖仅在打开面板时加载。省略此输入则不提供助手。                              |
| `onOpenFile`                                                               | `(() => void) \| undefined` | -       | 由宿主接管“文件 > 打开”操作，绕过内置原生文件选择器，随后由宿主提供新的 `content` 值。                        |

## 主题 {#theming}

| 输入    | 类型                       | 默认值 | 说明                                                                                                                          |
| ------- | -------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `theme` | `ViewerTheme \| undefined` | -      | 主题配置，包括部分颜色覆盖、自定义 `radius` 和任意 `cssVars`。未设置的值回退为内置深色主题。参见[主题](/zh/angular/theming)。 |

```ts
<pptx-viewer
  [content]="bytes"
  [theme]="{ colors: { primary: '#6366f1', background: '#0f172a' }, radius: '0.75rem' }"
/>
```

## 协作 {#collaboration}

这些输入用于启用和控制实时协同编辑。完整流程及 `CollaborationConfig` 结构请参见[实时协作](/zh/angular/collaboration)。

| 输入            | 类型                                                                      | 默认值 | 说明                                                                                                                 |
| --------------- | ------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `collaboration` | `CollaborationConfig \| undefined`                                        | -      | 提供后启用协同编辑，包括实时光标、在线状态和 Yjs CRDT 同步。需要 `yjs` peer 依赖，以及 `y-websocket` 或 `y-webrtc`。 |
| `shareDefaults` | `{ roomId?: string; userName?: string; serverUrl?: string } \| undefined` | -      | 共享或广播对话框字段的默认值。省略时字段为空，userName 回退为 `authorName`。                                         |

::: info 说明
与 React 和 Vue 一样，`collaboration` 是受控的。查看器不会自行启动会话，请监听 `startCollaboration` 以设置输入，监听 `stopCollaboration` 以清空输入。
:::

## 完整输入与输出列表 {#full-input-output-list}

```ts
class PowerPointViewerComponent {
	// Inputs
	readonly content = input<Uint8Array | ArrayBuffer | null>(null);
	readonly canEdit = input<boolean>(false);
	readonly class = input<string>('');
	readonly theme = input<ViewerTheme | undefined>(undefined);
	readonly filePath = input<string | undefined>(undefined);
	readonly fileName = input<string | undefined>(undefined);
	readonly collaboration = input<CollaborationConfig | undefined>(undefined);
	readonly authorName = input<string>();
	readonly shareDefaults = input<
		{ roomId?: string; userName?: string; serverUrl?: string } | undefined
	>(undefined);
	readonly onOpenFile = input<(() => void) | undefined>(undefined);
	readonly smartArt3D = input<boolean>(false);
	readonly surfaceChart3D = input<boolean>(false);
	readonly barChart3D = input<boolean>(false);
	readonly lineChart3D = input<boolean>(false);
	readonly areaChart3D = input<boolean>(false);
	readonly pieChart3D = input<boolean>(false);
	readonly ai = input<PptxAiConfig | undefined>(undefined);

	// Outputs
	readonly activeSlideChange = output<number>();
	readonly dirtyChange = output<boolean>();
	readonly contentChange = output<Uint8Array>();
	readonly propertiesChange = output<Partial<PptxCoreProperties>>();
	readonly modeChange = output<string>();
	readonly zoomChange = output<number>();
	readonly selectionChange = output<string[]>();
	readonly slideCountChange = output<number>();
	readonly startCollaboration = output<CollaborationConfig>();
	readonly stopCollaboration = output<void>();
}
```

## 功能触发方式 {#notes-on-triggering-features}

导航、模式切换、缩放、撤销与重做、选择操作均可以通过[公开 API](/zh/angular/api) 使用，例如 `viewer.goNext()`、`viewer.setMode('present')`。导出和打印通过内置功能区或对话框驱动，文档导出细节请参见[导出](/zh/angular/export)。
