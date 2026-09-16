---
title: 主题配置
description: 了解各框架共用的 ViewerTheme、CSS 自定义属性、内置预设，以及“文件 > 选项 > 外观”中的主题选择器。
---

# 主题配置 {#theming}

预览器的工具栏、功能区、对话框和文件后台界面通过 `ViewerTheme` 配置主题。它会将一组 CSS 自定义属性（`--pptx-*`）应用到组件根元素。这与演示文稿自身的 OOXML 配色和字体完全独立：“设计”选项卡的主题库会修改 `.pptx` 文档，而 `ViewerTheme` 只影响应用界面。

主题系统不依赖框架。下文的类型、默认值、预设和工具函数只在内部的 `pptx-viewer-shared` 包中实现一次，再由 `pptx-react-viewer`、`pptx-vue-viewer`、`pptx-angular-viewer`、`pptx-svelte-viewer` 和 `pptx-vanilla-viewer` 以相同方式导出。

## `ViewerTheme` 结构 {#the-viewertheme-shape}

```ts
interface ViewerTheme {
	/** Semantic UI colors. Each key maps to a `--pptx-<key>` custom property. */
	colors?: Partial<ViewerThemeColors>;
	/** Base border-radius value (e.g. "0.5rem", "8px"). */
	radius?: string;
	/** Escape hatch: arbitrary CSS custom properties set on the viewer root. Keys include the `--` prefix. */
	cssVars?: Record<string, string>;
}
```

所有字段均可选，未设置的值回退到内置深色主题。`ViewerThemeColors` 包含 19 个语义化颜色项，沿用 shadcn/ui 的命名习惯。它们接受任意有效的 CSS 颜色字符串，包括十六进制、`rgb()`、`hsl()`、`oklch()` 和命名颜色：

| 颜色项                                 | 用途                         |
| -------------------------------------- | ---------------------------- |
| `background`、`foreground`             | 根背景和默认文本             |
| `card`、`cardForeground`               | 卡片和面板                   |
| `popover`、`popoverForeground`         | 弹出层和下拉菜单             |
| `primary`、`primaryForeground`         | 主要操作，例如按钮和选中状态 |
| `secondary`、`secondaryForeground`     | 次要操作                     |
| `muted`、`mutedForeground`             | 弱化背景和次要文本           |
| `accent`、`accentForeground`           | 悬停高亮区域                 |
| `destructive`、`destructiveForeground` | 危险或删除操作               |
| `border`、`input`、`ring`              | 边框、输入框边框和焦点环     |

每个颜色项对应的完整 CSS 变量名称见 [React 主题配置](/zh/react/theming#viewertheme-and-viewerthemecolors)。

## `themeToCssVars` 如何生成 `--pptx-*` 变量 {#how-themetocssvars-produces-pptx-variables}

`themeToCssVars(theme, omitDefaults = false)` 将 `ViewerTheme` 转换为扁平的 CSS 自定义属性对象 `Record<string, string>`，可直接作为行内样式应用到组件根元素。传入主题后，各组件会在内部调用它；它也作为公共工具函数导出，供自定义工具使用。

- `colors` 中的每个键会变为 `--pptx-<kebab-case-key>`。例如，`primaryForeground: '#fff'` 会输出 `--pptx-primary-foreground: #fff`。
- 每个颜色还会同步到对应的 Tailwind 语义变量（如 `--color-primary-foreground`）。在 Tailwind CSS v4 宿主中，这样可以覆盖无法读取子元素变量的 `@theme` 声明。
- `radius` 会生成 `--pptx-radius`，以及派生的 `--radius-sm`、`--radius-md`、`--radius-lg` 和 `--radius-xl`，取值范围从 `calc(r - 4px)` 到 `calc(r + 4px)`。
- `cssVars` 中的项原样传递。
- 设置 `omitDefaults: true` 时，跳过与内置默认值相同的项。

```ts
import { themeToCssVars, defaultCssVars } from 'pptx-react-viewer';

themeToCssVars({ colors: { primary: '#6366f1' }, radius: '0.75rem' });
// {
//   '--pptx-primary': '#6366f1', '--color-primary': '#6366f1',
//   '--pptx-radius': '0.75rem',
//   '--radius-sm': 'calc(0.75rem - 4px)', ... '--radius-xl': 'calc(0.75rem + 4px)',
// }

defaultCssVars();
// The complete set of --pptx-* properties with the built-in dark defaults,
// for generating a full fallback stylesheet.
```

## 内置主题和预设 {#built-in-themes-and-presets}

| 导出项                                         | 配色                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `defaultThemeColors` + `defaultRadius`         | 内置深色界面，使用 Tailwind 灰阶、靛蓝主色和 `0.5rem` 圆角。未传入主题时使用。 |
| `vermilionLightTheme` / `vermilionLightColors` | 温暖的浅色纸张风格，使用与本文档站相同的朱红强调色。                           |
| `vermilionDarkTheme` / `vermilionDarkColors`   | 较暗的放映室风格，使用相同的强调色。                                           |
| `vermilionRadius`                              | `'0.375rem'`，两种朱红预设共用的圆角。                                         |

两种朱红预设都是完整的 `ViewerTheme` 对象，包含全部 19 个颜色项和圆角，可完整替换默认深色主题。同时还导出原始的 `*Colors` 配色，便于派生其他主题：

```ts
import { vermilionDarkColors, vermilionRadius } from 'pptx-react-viewer';
import type { ViewerTheme } from 'pptx-react-viewer';

const custom: ViewerTheme = {
	colors: { ...vermilionDarkColors, primary: '#38bdf8' },
	radius: vermilionRadius,
};
```

项目还包含普通浅色配色，但组件没有将其作为命名导出提供。可以通过主题目录获取：`resolveThemeCatalogEntry('light')`。

## 在各框架中应用主题 {#applying-a-theme-per-binding}

所有组件接收相同的 `ViewerTheme` 对象，只是传入方式不同。

::: code-group

```tsx [React]
import { PowerPointViewer, vermilionDarkTheme } from 'pptx-react-viewer';

<PowerPointViewer content={bytes} theme={vermilionDarkTheme} />;
```

```vue [Vue]
<script setup lang="ts">
import { PowerPointViewer, vermilionDarkTheme } from 'pptx-vue-viewer';
</script>

<template>
	<PowerPointViewer :content="bytes" :theme="vermilionDarkTheme" />
</template>
```

```ts [Angular]
// <pptx-viewer [content]="bytes" [theme]="theme" />
import { vermilionDarkTheme } from 'pptx-angular-viewer';

export class DeckComponent {
	theme = vermilionDarkTheme;
}
// Or share one theme across a subtree without the input:
// providers: [provideViewerTheme(vermilionDarkTheme)]
```

```svelte [Svelte]
<script lang="ts">
	import { PowerPointViewer, vermilionDarkTheme } from 'pptx-svelte-viewer';
</script>

<PowerPointViewer content={bytes} theme={vermilionDarkTheme} />
```

```ts [Vanilla]
import { createPptxViewer, vermilionDarkTheme } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(host, {
	source: bytes,
	theme: vermilionDarkTheme,
});
// Change later at runtime:
viewer.setTheme({ colors: { primary: '#38bdf8' } });
```

:::

多个预览器需要共享主题时，React 提供 `ViewerThemeProvider` 和 `useViewerTheme`，Vue 提供 `provideViewerTheme` 和 `useViewerTheme`，Angular 提供 `provideViewerTheme` 和 `VIEWER_THEME` 注入令牌。

## 样式接入方式 {#styling-modes}

组件的视觉样式通过 `--pptx-*` 自定义属性引用，可以按控制程度选择以下三种接入方式：

| 方式                     | 配置                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 宿主使用 Tailwind CSS v4 | 无需额外导入 CSS，组件类名通过现有配置解析。通过 `theme` 属性覆盖取值。                                                                                |
| 使用随包提供的样式表     | `import 'pptx-react-viewer/styles'`。Vue 和 Angular 同样提供 `/styles` 和 `/styles.css`；Svelte 将样式编译到组件中。样式表包含所需工具类和深色默认值。 |
| 直接设置 CSS 自定义属性  | 自行定义 `--pptx-*` 属性，完整列表可通过 `defaultCssVars()` 获取，无需使用前两种方式。                                                                 |

Vanilla 组件有所不同：`createPptxViewer` 会自动且幂等地注入自身的作用域样式表（`#pptx-vanilla-viewer-styles`）。采用严格 CSP 的宿主可以改为预先渲染 `getViewerCss()` 返回的字符串。

## 选择控件外观 {#selection-control-artwork}

五种框架的选择控件均使用现有的 `ViewerTheme.cssVars` 字段，不需要新的主题对象或组件属性。
省略这些可选令牌时，各框架保留自己的默认外观。它们只影响编辑器控件，
不会修改幻灯片内容、字号、文档几何信息或导出的文档。

| CSS 自定义属性                         | 用途                           |
| -------------------------------------- | ------------------------------ |
| `--pptx-selection-corner-size`         | 角部图形的宽度和高度           |
| `--pptx-selection-corner-radius`       | 角部图形的圆角                 |
| `--pptx-selection-edge-length`         | 边缘图形沿边方向的长度         |
| `--pptx-selection-edge-thickness`      | 边缘图形垂直于边的厚度         |
| `--pptx-selection-edge-radius`         | 边缘图形的圆角                 |
| `--pptx-selection-handle-fill`         | 缩放图形的填充颜色             |
| `--pptx-selection-handle-border-color` | 缩放和旋转图形的边框颜色       |
| `--pptx-selection-outline-color`       | 选择轮廓和现有旋转连接线的颜色 |
| `--pptx-selection-rotate-size`         | 圆形旋转图形的直径             |
| `--pptx-selection-rotate-fill`         | 旋转图形的填充颜色             |
| `--pptx-selection-rotate-foreground`   | 绘制旋转图标时的图标颜色       |

尺寸应使用 `6px` 等正像素长度，圆角使用有效 CSS 长度或百分比，颜色使用有效
CSS 颜色。`var()` 仅在令牌省略时使用回退值，不会修复任意无效的 CSS 值。
查看器不会解析或清理这些 CSS 字符串。删除覆盖值即可恢复该框架的默认值。
圆角与现有边框和阴影一样，使用控件本地 CSS 坐标，不会单独补偿舞台缩放。
可使用 `0px` 设置直角，或使用 `50%` 在各框架中保持按比例的圆形外观。

```ts
const theme = {
	cssVars: {
		'--pptx-selection-corner-size': '6px',
		'--pptx-selection-corner-radius': '0px',
		'--pptx-selection-edge-length': '6px',
		'--pptx-selection-edge-thickness': '6px',
		'--pptx-selection-edge-radius': '0px',
		'--pptx-selection-handle-fill': '#ffffff',
		'--pptx-selection-handle-border-color': '#6366f1',
		'--pptx-selection-outline-color': '#6366f1',
		'--pptx-selection-rotate-fill': '#ffffff',
		'--pptx-selection-rotate-foreground': '#6366f1',
	},
};
```

通过上文各框架的方式传入同一个主题。自定义外壳可将 `themeToCssVars(theme)`
应用到幻灯片与选择控件的共同祖先元素。不要依赖内部子元素类名，也不要假设
控件一定嵌套在被选中的形状内部。

可见图形始终以现有锚点为中心。缩小图形不会缩小原有的鼠标或触摸命中区域。
较大的图形会扩大自身框体，但小形状上仍保留相邻控件的命中区域划分；过大的
图形可能在视觉上重叠，但不能夺取另一控件的输入区域。本约定不提供命中尺寸
或旋转偏移量配置。自定义图形应保持适合所编辑形状的尺寸。调整菱形和连接线
端点指示器保留其不同含义与外观。

## 文件 > 选项 > 外观 {#file-options-appearance}

每个组件的设置对话框都有**外观**选项卡，提供默认、浅色、朱红浅色和朱红深色等内置预设，用户可以在运行时点击切换。这些预设由 `THEME_CATALOG` 导出定义：

```ts
interface ThemeCatalogEntry {
	key: string; // 'default' | 'light' | 'vermilionLight' | 'vermilionDark'
	labelKey: string; // pptx.* translation key for the entry's label
	theme: ViewerTheme | undefined; // undefined = reset to the built-in default
}
```

内置目录只提供少量预设。若要增加或减少选项，可以传入下文的 `availableThemes`。`resolveThemeCatalogEntry(key, catalog?)` 根据键查找目录项。

### 优先级：显式 `theme` 始终优先 {#precedence-an-explicit-theme-always-wins}

向组件传入 `theme` 属性后，它的优先级始终高于外观选项卡中的选择，此时选择器不生效。这是有意的设计：宿主自行管理主题时，例如与应用级深色模式同步，组件内部的点击不应覆盖宿主设置。

只有**未传入**显式 `theme` 时，外观选项卡才会生效。在这种独立使用模式下，解析顺序为：

1. `defaultThemeKey` 属性，用于指定非 `'default'` 的初始主题。
2. 之前持久化的选择，保存在 `localStorage` 的 `pptx-viewer-prefs` 键中。
3. 目录中的 `'default'` 项。

### 目录相关属性（均可选） {#catalog-props-all-optional}

| 属性               | 类型                     | 用途                                                                        |
| ------------------ | ------------------------ | --------------------------------------------------------------------------- |
| `defaultThemeKey`  | `string`                 | 初始 `THEME_CATALOG` 键，仅在没有持久化选择时使用。                         |
| `availableThemes`  | `ThemeCatalogEntry[]`    | 覆盖外观选项卡中的目录，可添加自定义预设或减少选项。                        |
| `onThemeChange`    | `(key: string) => void`  | 提供后由**宿主**负责持久化选择，组件不再写入 `localStorage`，只调用此回调。 |
| `defaultLocale`    | `string`                 | 语言的初始代码，同样仅在没有持久化选择时使用。                              |
| `availableLocales` | `LocaleCatalogEntry[]`   | 覆盖“选项 > 语言”中的语言列表。                                             |
| `onLocaleChange`   | `(code: string) => void` | 提供后，组件不会自行操作 i18n 实例，只调用此回调。                          |

React、Vue、Angular 和 Svelte 使用相同结构。Vanilla 已有公开的 `theme`、`locale` 构造选项和 `setTheme()`、`setLocale()` 方法，因此直接使用它们提供初始值，不另设 `defaultThemeKey` 或 `defaultLocale`。其 `availableThemes`、`availableLocales`、`onThemeChange` 和 `onLocaleChange` 与其他组件相同。

```tsx
// React - host owns theme persistence (e.g. syncing with app-wide dark mode)
<PowerPointViewer
	content={bytes}
	defaultThemeKey={systemPrefersDark ? 'vermilionDark' : 'vermilionLight'}
	onThemeChange={(key) => saveUserPreference('viewerTheme', key)}
/>
```

### 添加自定义预设 {#adding-your-own-presets}

通过 `availableThemes` 传入自定义 `ThemeCatalogEntry[]`。如果希望保留内置主题，可以展开 `THEME_CATALOG` 后追加：

```ts
import { THEME_CATALOG } from 'pptx-react-viewer';

const availableThemes = [
	...THEME_CATALOG,
	{ key: 'brand', labelKey: 'app.theme.brand', theme: { colors: { primary: '#7c3aed' } } },
];
```

`labelKey` 通过应用提供的 i18n 字典查找，详见[国际化](/zh/guide/localization)。自定义项需要自行注册对应翻译键；未注册时，会从键的最后一段生成可读名称作为回退。

## 各框架的详细说明 {#per-binding-details}

- [React 主题配置](/zh/react/theming)：`theme` 属性、`ViewerThemeProvider` 和完整颜色表。
- [Vue 主题配置](/zh/vue/theming)：`theme` 属性和 `provideViewerTheme`。
- [Angular 主题配置](/zh/angular/theming)：`theme` 输入、`provideViewerTheme` 和 `VIEWER_THEME` 令牌。
- [Svelte 主题配置](/zh/svelte/theming)：`theme` 属性。
- [原生 JavaScript 主题配置](/zh/vanilla/theming)：`theme` 选项、`setTheme()` 和 `getViewerCss()`。

## 下一步 {#next-steps}

- [国际化](/zh/guide/localization)：语言选项卡遵循相同机制，主题名称使用的 `pptx.*` 翻译键也由这里说明。
- [账号与登录](/zh/guide/account)：“文件 > 账号”中的个人资料与主题、语言回退设置使用同一个 `localStorage` 键。
