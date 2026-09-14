---
title: 组件属性
description: PowerPointViewerProps 参考，涵盖内容、编辑、回调、主题、协作以及自动保存与恢复。
---

# 组件属性 {#component-props}

自定义宿主尺寸时，请参阅[视口适配](/zh/guide/viewport-fit)，了解 `fitPadding`、`maxFitScale`、各框架示例和默认值。

`PowerPointViewer` 接收下文的 `PowerPointViewerProps` 接口。只有 `content` 必填，其余均可选。此参考直接对应源码接口。

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerProps } from 'pptx-react-viewer';
```

::: tip 提示
`PowerPointViewer` 使用 `forwardRef`，因此还可传入 [`PowerPointViewerHandle`](/zh/react/handle) 类型的 `ref`，它不属于 `PowerPointViewerProps`。
:::

## 内容 {#content}

| 属性                 | 类型         | 默认值                | 说明                                                                                           |
| -------------------- | ------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| `content`            | `Uint8Array` | 必填                  | 原始 `.pptx` 字节。`ArrayBuffer` 需通过 `new Uint8Array(buf)` 包装。                           |
| `filePath`           | `string`     | -                     | 原始文件路径或名称，用作自动保存恢复的键，并显示在标题栏。                                     |
| `autosave`           | `boolean`    | `true`                | 控制恢复快照的自动保存，是标题栏开关之上的宿主策略上限，详见[自动保存策略](#autosave-policy)。 |
| `autosaveIntervalMs` | `number`     | “文件 > 选项”中的间隔 | 恢复快照的保存间隔。显式值优先于用户的自动恢复设置。                                           |

::: warning content 类型
该属性使用 `Uint8Array`，不是 `ArrayBuffer`。从 `fetch` 或文件得到 `ArrayBuffer` 后的转换方式见[快速接入](/zh/react/getting-started)。
:::

::: tip 自动保存恢复需要 filePath
组件定时将文档序列化到 IndexedDB，以 `filePath` 为键。重载页面时，会检查相同 `filePath` 对应的近期快照。如果宿主没有持久保存并重新传入该值，恢复流程不会触发。详见下文[自动保存与恢复](#autosave-recovery)。
:::

## 编辑 {#editing}

| 属性      | 类型      | 默认值  | 说明                                                                        |
| --------- | --------- | ------- | --------------------------------------------------------------------------- |
| `canEdit` | `boolean` | `false` | 启用工具栏编辑、属性面板编辑、行内文本编辑和幻灯片管理。为 `false` 时只读。 |

## 回调 {#callbacks}

| 属性                  | 类型                             | 默认值 | 说明                                                              |
| --------------------- | -------------------------------- | ------ | ----------------------------------------------------------------- |
| `onDirtyChange`       | `(isDirty: boolean) => void`     | -      | 未保存修改标记变化时调用。                                        |
| `onContentChange`     | `(content: Uint8Array) => void`  | -      | 内容变化时返回重新序列化后的文档字节。                            |
| `onActiveSlideChange` | `(slideIndex: number) => void`   | -      | 当前幻灯片变化时调用。                                            |
| `onModeChange`        | `(mode: ViewerMode) => void`     | -      | 模式变化时调用，例如从编辑切换到放映。                            |
| `onZoomChange`        | `(zoom: number) => void`         | -      | 缩放比例变化时调用。                                              |
| `onSelectionChange`   | `(elementIds: string[]) => void` | -      | 元素选择变化时调用。                                              |
| `onSlideCountChange`  | `(count: number) => void`        | -      | 添加或删除幻灯片导致总数变化时调用。                              |
| `onOpenFile`          | `() => void`                     | -      | 覆盖“文件 > 打开”，跳过内置选择器，由宿主随后传入新的 `content`。 |

::: info 说明
`onContentChange` 返回序列化文档的 `Uint8Array`，不是布尔值。需要主动获取内容时，使用句柄的 [`getContent()`](/zh/react/handle)。
:::

## 展示与创作 {#presentation-authoring}

| 属性                                                                       | 类型           | 默认值  | 说明                                                                                                                |
| -------------------------------------------------------------------------- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `authorName`                                                               | `string`       | -       | 批注和标记的作者显示名称。协作时回退到 `collaboration.userName`，否则回退到 `'You'`。                               |
| `className`                                                                | `string`       | -       | 添加到组件根元素的可选类名。                                                                                        |
| `smartArt3D`                                                               | `boolean`      | `false` | 启用基于 WebGL 的 Three.js SmartArt 挤出三维块渲染器，需要可选同级依赖 `three`，缺少时回退到 SVG。                  |
| `surfaceChart3D`、`barChart3D`、`lineChart3D`、`areaChart3D`、`pieChart3D` | `boolean`      | `false` | 分别启用对应三维图表的交互式 Three.js 渲染器。缺少 `three` 或图表无法作为 WebGL 场景渲染时，回退到对应 SVG 渲染器。 |
| `ai`                                                                       | `PptxAiConfig` | -       | 启用可选智能助手。SDK 同级依赖只在打开面板时加载，省略则不提供助手。                                                |

## 主题 {#theming}

| 属性    | 类型          | 默认值 | 说明                                                                                                                |
| ------- | ------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `theme` | `ViewerTheme` | -      | 支持局部颜色覆盖、自定义 `radius` 和任意 `cssVars`。未设置项回退到内置深色主题，详见[主题配置](/zh/react/theming)。 |

```tsx
<PowerPointViewer
	content={bytes}
	theme={{
		colors: { primary: '#6366f1', background: '#0f172a' },
		radius: '0.75rem',
	}}
/>
```

## 协作 {#collaboration}

以下属性启用和控制实时共同编辑。完整流程和 `CollaborationConfig` 结构见[协作](/zh/react/collaboration)。

| 属性                   | 类型                                                         | 默认值 | 说明                                                                                 |
| ---------------------- | ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| `collaboration`        | `CollaborationConfig`                                        | -      | 提供后启用远程光标、在线状态和 Yjs CRDT 同步，需要 `yjs` 和 `y-websocket` 同级依赖。 |
| `onStartCollaboration` | `(config: CollaborationConfig) => void`                      | -      | 用户从共享对话框创建会话时调用，宿主应使用返回配置设置 `collaboration`。             |
| `onStopCollaboration`  | `() => void`                                                 | -      | 用户从共享对话框停止会话时调用，宿主应清空 `collaboration`。                         |
| `shareDefaults`        | `{ roomId?: string; userName?: string; serverUrl?: string }` | -      | 共享对话框字段的默认值，省略时为空。                                                 |

::: info 说明
`collaboration` 是受控属性，组件不会自行启动会话。请在 `onStartCollaboration` 中设置，在 `onStopCollaboration` 中清空。
:::

## 接口示意 {#interface-sketch}

::: info 节选
下面只展示常用成员，并非完整类型。`PowerPointViewerProps` 还包含 `ai`、`accountAuth`、`hiddenActions`、`fonts`、`fileName`、`availableThemes`、`defaultThemeKey`、`onThemeChange`、`availableLocales`、`defaultLocale`、`onLocaleChange`、`onModeChange`、`onSelectionChange`、`onSlideCountChange` 和 `onZoomChange`。完整列表以包内 `.d.ts` 或 `packages/react/src/viewer/types-ui.ts` 为准。
:::

```ts
interface PowerPointViewerProps {
	content: Uint8Array;
	filePath?: string;

	onDirtyChange?: (isDirty: boolean) => void;
	onContentChange?: (content: Uint8Array) => void;
	onActiveSlideChange?: (slideIndex: number) => void;
	onOpenFile?: () => void;

	canEdit?: boolean;
	className?: string;
	authorName?: string;
	smartArt3D?: boolean;
	surfaceChart3D?: boolean;
	barChart3D?: boolean;
	lineChart3D?: boolean;
	areaChart3D?: boolean;
	pieChart3D?: boolean;
	ai?: PptxAiConfig;

	theme?: ViewerTheme;

	collaboration?: CollaborationConfig;
	onStartCollaboration?: (config: CollaborationConfig) => void;
	onStopCollaboration?: () => void;
	shareDefaults?: {
		roomId?: string;
		userName?: string;
		serverUrl?: string;
	};
}
```

## 功能触发方式 {#notes-on-triggering-features}

导航、模式切换、缩放、撤销重做和选择可以通过命令式[句柄](/zh/react/handle)控制，例如 `ref.current.goNext()` 或 `ref.current.setMode('present')`。导出和打印通过内置工具栏和对话框发起，详见[导出](/zh/react/export)。

## 自动保存与恢复 {#autosave-recovery}

`canEdit` 为 true 且提供 `filePath` 时，组件会定时将恢复快照保存到 **IndexedDB**，默认每 120 秒一次。即使关闭页面或发生崩溃，数据仍保留在浏览器中。

### 工作方式 {#how-it-works}

1. 每隔 120 秒检查文档是否有未保存修改，间隔可配置。
2. 存在修改时，将当前状态序列化为 `Uint8Array`，存入 IndexedDB 数据库 `pptx-viewer-autosave`，以 `filePath` 为键。
3. 下次加载相同 `filePath`，且幻灯片加载完成后，检查 24 小时内的近期快照，并打开版本历史面板。

### 宿主的职责 {#host-responsibility}

组件**不会**自行跨页面重载持久保存 `filePath`，宿主必须：

1. **记住文件标识**，例如保存在 `localStorage`、URL 参数或后端会话中。
2. 页面重载、组件重新挂载时，**再次传入 `filePath`**。

否则，恢复检查没有可查找的键，无法找到之前的快照。

### 恢复工具函数（共享包） {#recovery-helpers-shared-package}

`pptx-viewer-shared` 导出用于自定义恢复流程的底层工具：

```ts
import {
	getAutosaveSnapshot,
	listAutosaveSnapshots,
	deleteAutosaveSnapshot,
	saveAutosaveSnapshot,
} from 'pptx-viewer-shared';

// List all stored snapshots (without the heavy data blob)
const snapshots = await listAutosaveSnapshots();
// => [{ key: 'report.pptx', timestamp: 1720300000000, size: 524288 }, ...]

// Retrieve a specific snapshot by its key (filePath)
const snapshot = await getAutosaveSnapshot('report.pptx');
if (snapshot) {
	// snapshot.data is a Uint8Array you can pass as `content`
	setContent(snapshot.data);
}

// Delete a snapshot (e.g. after the user dismisses recovery)
await deleteAutosaveSnapshot('report.pptx');
```

### 刷新后重新打开文稿 {#session-restore}

恢复快照用于找回标签页崩溃时的编辑，而更常见的普通**刷新**有专门的工具函数。每个组件都重新导出 `rememberSessionDeck` 和 `restoreSessionDeck`，也可从 `pptx-viewer-shared` 获取。它们按**浏览器标签页**记住当前打开的文稿，并在下次加载时返回：

```ts
import { rememberSessionDeck, restoreSessionDeck } from 'pptx-react-viewer';

// After the host loads a deck:
await rememberSessionDeck(file.name, bytes);

// On mount, before falling back to your file picker:
const deck = await restoreSessionDeck();
if (deck) {
	setContent(deck.data);
	setFilePath(deck.fileName);
}
```

- **范围限定为当前标签页。** 记录使用 `sessionStorage` 中的 ID 作为键，因此刷新会重新打开文稿，新标签页仍从空白开始，两个标签页中的不同文稿不会相互替换。
- **保留编辑。** `restoreSessionDeck()` 优先选择相同 `fileName` 下更新的自动保存快照，因此编辑过程中刷新会恢复修改后的文稿，而非最初打开的字节。
- **覆盖组件自身的“文件 > 打开”。** 文件后台或最近使用列表会在组件内部切换文稿而不通知宿主，因此这些路径会自行记录会话文稿。
- `forgetSessionDeck()` 删除记录。所有调用均尽力执行，IndexedDB 被阻止或 `sessionStorage` 被分区时，会回退为没有可恢复内容，不抛出错误。

五个演示应用均使用这套流程，因此刷新后仍可保留当前演示文稿。

### 示例：页面重载时恢复 {#example-recovery-on-page-reload}

```tsx
import { useEffect, useState } from 'react';
import { getAutosaveSnapshot } from 'pptx-viewer-shared';
import { PowerPointViewer } from 'pptx-react-viewer';

const STORAGE_KEY = 'my-app-last-file';

function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);
	const [filePath, setFilePath] = useState('');

	// On mount, check for a recovery snapshot
	useEffect(() => {
		const lastFile = localStorage.getItem(STORAGE_KEY);
		if (!lastFile) return;

		getAutosaveSnapshot(lastFile).then((snapshot) => {
			if (snapshot && Date.now() - snapshot.timestamp < 24 * 60 * 60 * 1000) {
				// Offer recovery (or auto-restore)
				setContent(snapshot.data);
				setFilePath(snapshot.key);
			}
		});
	}, []);

	// When user opens a file, persist the name
	function handleOpen(file: File) {
		localStorage.setItem(STORAGE_KEY, file.name);
		setFilePath(file.name);
		file.arrayBuffer().then((buf) => setContent(new Uint8Array(buf)));
	}

	if (!content) return <FileDropzone onFile={handleOpen} />;

	return <PowerPointViewer content={content} filePath={filePath} canEdit />;
}
```

### autosave 属性和自动保存开关，谁优先 {#autosave-policy}

宿主属性和用户开关都能控制自动保存，五个组件使用共享函数 `resolveAutosaveActivation` 统一裁决：

> **`autosave` 属性决定策略上限，标题栏开关表达该范围内的用户偏好。**

| autosave 属性 | 实际行为                                       | 开关                         |
| ------------- | ---------------------------------------------- | ---------------------------- |
| 省略          | 允许自动保存，由用户开关决定，默认**开启**。   | 可用。                       |
| `true`        | 与省略相同，宿主允许，由用户决定。             | 可用。                       |
| `false`       | 关闭自动保存，不写快照，也不在加载时提示恢复。 | **不可操作**，状态不能切换。 |

显式属性表示应用允许的范围，用户开关不能越过这个范围，因此 `autosave={false}` 也会禁用开关。还必须满足两个前提：`canEdit` 为 true，并且设置了 `filePath`，否则没有可写内容或保存位置。

保存间隔遵循同样规则：显式 `autosaveIntervalMs` 是宿主策略，按传入值执行；省略时，使用**文件 > 选项 > 保存 > 每 N 分钟保存自动恢复信息**中的用户设置，默认两分钟。

自动保存默认开启，以便默认提供崩溃恢复。需要退出此行为时传入 `autosave={false}`。

### 恢复快照 {#recovering-a-snapshot}

文稿加载完成后，如果相同 `filePath` 存在 24 小时内的快照，会显示 **是否恢复未保存的更改？** 对话框。恢复会加载快照字节，丢弃会删除快照。如果当前标签页已接收该快照，例如宿主通过 `restoreSessionDeck` 恢复过，则不会再次提示。

### 前提条件与状态反馈 {#requirements-and-status-feedback}

条件不满足时，自动保存会停用，并在标题栏显示原因：

| 条件               | 显示状态                       | 原因                                           |
| ------------------ | ------------------------------ | ---------------------------------------------- |
| 未提供 `filePath`  | 自动保存已禁用：未提供文件路径 | 需要稳定的键保存快照，传入 `filePath` 可启用。 |
| 用户关闭自动保存   | 自动保存已关闭                 | 用户通过标题栏开关主动停用。                   |
| `autosave={false}` | 此应用已关闭自动保存           | 宿主禁止此功能，开关不可操作。                 |
| `canEdit` 为 false | 自动保存已禁用：演示文稿为只读 | 自动保存仅在编辑模式下适用。                   |

补齐条件，例如设置 `filePath` 后，状态会自动回到 `'idle'` 并启动计时器。

`AutosaveStatus` 类型如下：

```ts
type AutosaveStatus =
	| { state: 'idle' }
	| { state: 'disabled'; reason: string }
	| { state: 'saving' }
	| { state: 'saved'; timestamp: number }
	| { state: 'error'; message: string };
```

`reason` 为 `'autosave_host_off'`、`'autosave_toggle_off'`、`'no_file_path'` 或 `'read_only'`，共享的 `autosaveDisabledReasonKey` 分别将其映射到 `pptx.autosave.disabledByHost`、`pptx.autosave.disabledToggleOff`、`pptx.autosave.disabledNoFilePath` 和 `pptx.autosave.disabledReadOnly`。
