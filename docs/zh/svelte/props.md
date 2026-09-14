---
title: Svelte 查看器组件属性
description: PowerPointViewer Svelte 5 组件完整的属性和事件回调约定，涵盖内容、外观、界面、编辑、自动保存和协作。
---

# 组件属性 {#component-props}

自定义宿主尺寸时，请参阅[视口适配](/zh/guide/viewport-fit)，了解 `fitPadding`、`maxFitScale`、各框架示例和默认值。

`<PowerPointViewer>` 遵循 Vue 绑定的约定，同时采用两项 Svelte 5 惯例：事件使用**回调属性**（`onload`，而非 `@load`），内容属性命名为 **`source`**。

## 内容与外观 {#content-and-appearance}

| 属性     | 类型                                             | 默认值 | 说明                                                                                   |
| -------- | ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| `source` | `Uint8Array \| ArrayBuffer \| null \| undefined` | -      | 原始 `.pptx` 字节。赋予新值会在原位置加载新的演示文稿。                                |
| `fonts`  | `ViewerFontSource[]`                             | -      | 宿主提供的已授权字体来源（`{ family, src, format?, weight?, style? }`）。              |
| `theme`  | `ViewerTheme`                                    | 内置   | 部分调色板、圆角和原始 CSS 变量，参见[主题](/zh/svelte/theming)。                      |
| `locale` | `string`                                         | `'en'` | 界面语言（BCP 47）。通过 [`pptx-svelte-viewer/i18n`](/zh/svelte/i18n) 注册非英文字典。 |
| `class`  | `string`                                         | -      | 根元素上的额外类名。                                                                   |

## 界面与行为 {#chrome-and-behaviour}

| 属性                                                                       | 类型                | 默认值  | 说明                                                                                                          |
| -------------------------------------------------------------------------- | ------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `initialSlide`                                                             | `number`            | `0`     | 加载后显示的幻灯片，索引从 0 开始，自动限制在有效范围内。                                                     |
| `showThumbnails`                                                           | `boolean`           | `true`  | 显示缩略图侧边栏。                                                                                            |
| `showToolbar`                                                              | `boolean`           | `true`  | 显示导航和缩放工具栏，并在 `editable` 启用时显示功能区。                                                      |
| `showNotes`                                                                | `boolean`           | `true`  | 显示演讲者备注面板及工具栏开关。传入 `onnotesupdate` 可编辑备注，省略时备注只读。                             |
| `hiddenActions`                                                            | `ToolbarActionId[]` | -       | 要隐藏的工具栏按钮或功能区选项卡，参见[下方取值](#hiddenactions-values)。                                     |
| `fileName`                                                                 | `string`            | -       | 桌面标题栏中显示的名称。                                                                                      |
| `smartArt3D`                                                               | `boolean`           | `false` | 按需启用 Three.js（WebGL）SmartArt 渲染器。需要可选的 `three` 依赖；依赖不可用或 WebGL 挂载失败时回退为 SVG。 |
| `surfaceChart3D`, `barChart3D`, `lineChart3D`, `areaChart3D`, `pieChart3D` | `boolean`           | `false` | 分别启用对应三维图表类型的交互式 Three.js 渲染器。缺少 `three`，或图表无法渲染为 WebGL 场景时，均回退为 SVG。 |
| `ai`                                                                       | `PptxAiConfig`      | -       | 启用可选智能助手。SDK 同级依赖只在打开面板时加载，省略则不提供助手。                                          |
| `editable`                                                                 | `boolean`           | `false` | 启用原地编辑，包括选择、拖动、缩放和旋转控点、双击文本编辑、键盘快捷键、撤销和重做、保存和下载。              |

### `hiddenActions` 取值 {#hiddenactions-values}

`ToolbarActionId` 是快速访问**按钮** ID 和功能区**选项卡** ID 的联合：

- 按钮：`share`、`broadcast`、`export`、`undo`、`redo`、`record`、`notes`、`fullscreen`、`zoom`、`navigation`。
- 选项卡：`file`、`home`、`insert`、`draw`、`design`、`transitions`、`animations`、`slideShow`、`record`、`review`、`view`、`help`。

`zoom` 和 `navigation` 分别隐藏整个对应控件组。快速访问按钮和功能区选项卡共享 `record`，隐藏它会同时移除两者。

```svelte
<!-- A read-only embed with the collaboration entry points removed -->
<PowerPointViewer source={bytes} hiddenActions={['share', 'broadcast']} />
```

## 文件 > 选项中的选择器 {#options-pickers}

以下属性驱动“文件 > 选项”中的内置外观和语言选择器。不提供 `on*Change` 回调时，用户选择会自动持久化到 `localStorage`；提供回调后由宿主管理持久化。

| 属性               | 类型                            | 默认值                         | 说明                                                                                  |
| ------------------ | ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| `defaultThemeKey`  | `string`                        | 已存储的值，否则为 `'default'` | 初始外观选择，对应 `availableThemes` 或内置 `THEME_CATALOG` 中的键。                  |
| `availableThemes`  | `readonly ThemeCatalogEntry[]`  | `THEME_CATALOG`                | 外观选择器提供的主题选项。                                                            |
| `onThemeChange`    | `(themeKey: string) => void`    | -                              | 用户选择主题时触发，来源可以是设计选项卡或选项设置。                                  |
| `defaultLocale`    | `string`                        | 已存储的值，否则为 `locale`    | 初始语言选择，即语言代码。                                                            |
| `availableLocales` | `readonly LocaleCatalogEntry[]` | 已注册的语言                   | 语言选择器提供的选项，默认为通过 `registerTranslations` 注册的所有语言。              |
| `onLocaleChange`   | `(locale: string) => void`      | -                              | 用户从选项设置选择语言时触发。                                                        |
| `accountAuth`      | `AccountAuthConfig`             | 禁用                           | “文件 > 账户”中接入真实登录流程的可选入口（`{ enabled, onSignIn, signedInUser? }`）。 |

::: tip 优先级
用户从界面选择主题后，该目录键会在剩余会话中决定实际主题；解析后的键为 `'default'` 时，`theme` 属性仍然优先。同样，在当前会话中，用户选择的语言始终优先于 `locale` 属性。
:::

## 自动保存 {#autosave}

完整流程请参见[快速上手 > 自动保存](/zh/svelte/getting-started#autosave)。

| 属性                 | 类型      | 默认值                | 说明                                                                                                     |
| -------------------- | --------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| `autosave`           | `boolean` | `true`                | 将恢复快照自动保存到共享 IndexedDB 存储，需要 `filePath`。它是标题栏开关可启用范围的策略上限，详见下文。 |
| `filePath`           | `string`  | -                     | IndexedDB 记录键，通常使用打开文件的名称或路径。未提供时自动保存不生效。                                 |
| `autosaveIntervalMs` | `number`  | “文件 > 选项”中的间隔 | 防抖时间窗口，单位为毫秒。显式值优先于用户的自动恢复设置。                                               |

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

## 协作 {#collaboration}

配置结构和传输方式请参见[实时协作](/zh/svelte/collaboration)。

| 属性            | 类型                                                         | 默认值 | 说明                                                 |
| --------------- | ------------------------------------------------------------ | ------ | ---------------------------------------------------- |
| `collaboration` | `CollaborationConfig`                                        | -      | 设置后连接房间并实时同步编辑；清空后结束会话。       |
| `shareDefaults` | `{ roomId?: string; userName?: string; serverUrl?: string }` | -      | 内置共享对话框的预填值，广播对话框复用 `serverUrl`。 |

## 事件回调 {#event-callbacks}

| 属性                   | 签名                                    | 触发时机                                                                  |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `onload`               | `(detail: ViewerLoadDetail) => void`    | 演示文稿完成加载，载荷为 `{ slideCount, canvasSize }`。                   |
| `onerror`              | `(message: string) => void`             | 加载失败，消息为可读文本。                                                |
| `onslidechange`        | `(index: number) => void`               | 当前幻灯片变化，索引从 0 开始。                                           |
| `onchange`             | `() => void`                            | 每次提交编辑修改后，包括移动、缩放、旋转、删除、复制、微移、文本和备注。  |
| `ondirtychange`        | `(dirty: boolean) => void`              | 未保存编辑标记变化。                                                      |
| `oncontentchange`      | `(content: Uint8Array) => void`         | 序列化的文档字节变化。                                                    |
| `onmodechange`         | `(mode: string) => void`                | 查看器模式变化（`'preview' \| 'edit' \| 'present' \| 'master'`）。        |
| `onzoomchange`         | `(zoom: number) => void`                | 缩放级别变化，1 表示 100%。                                               |
| `onselectionchange`    | `(elementIds: string[]) => void`        | 元素选区变化。                                                            |
| `onslidecountchange`   | `(count: number) => void`               | 幻灯片总数变化。                                                          |
| `onnotesupdate`        | `(notes: string) => void`               | 用户提交演讲者备注编辑，通过 `change` / `blur` 触发。省略时备注面板只读。 |
| `onopenfile`           | `() => void`                            | 宿主接管“文件 > 打开”操作。                                               |
| `onautosave`           | `(bytes: Uint8Array) => void`           | 每次成功生成自动保存快照后。                                              |
| `onautosavetoggle`     | `(enabled: boolean) => void`            | 桌面标题栏切换自动保存。                                                  |
| `onstartcollaboration` | `(config: CollaborationConfig) => void` | 用户从共享或广播对话框启动会话。                                          |
| `onstopcollaboration`  | `() => void`                            | 用户停止协作会话。                                                        |
| `onThemeChange`        | `(themeKey: string) => void`            | 用户选择主题。注意名称采用 camelCase，属于上面的选项选择器分组。          |
| `onLocaleChange`       | `(locale: string) => void`              | 用户选择语言，采用 camelCase，属于选项选择器分组。                        |

## 载荷类型 {#payload-types}

```ts
interface ViewerLoadDetail {
	/** Number of slides in the loaded presentation. */
	slideCount: number;
	/** Slide canvas size in pixels. */
	canvasSize: CanvasSize; // { width: number; height: number }
}
```

## 类型导出 {#type-exports}

```ts
import type {
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	PowerPointViewerApi,
	PowerPointViewerProps,
	ViewerLoadDetail,
	ViewerTheme,
	ViewerThemeColors,
	AutosaveStatus,
	AutosaveRecord,
} from 'pptx-svelte-viewer';
```

主题预设和辅助函数（`vermilionLightTheme`、`vermilionDarkTheme`、`defaultThemeColors`、`defaultRadius`、`themeToCssVars`、`defaultCssVars`）从包根入口导出；国际化辅助函数（`registerTranslations`、`translate`、`keyToLabel`、`translationsEn` 和 `TranslationKey` 类型）位于 `pptx-svelte-viewer/i18n`。参见[主题](/zh/svelte/theming)和[本地化](/zh/svelte/i18n)。
