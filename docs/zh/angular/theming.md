---
title: 主题
description: 使用 ViewerTheme 类型、defaultThemeColors、themeToCssVars、provideViewerTheme 和 --pptx-* CSS 自定义属性定制查看器。
---

# 主题配置 {#theming}

查看器界面由工具类构建，每个视觉令牌都引用 **CSS 自定义属性**（`--pptx-*`），与 React 和 Vue 绑定完全一致。因此可以按控制程度从低到高采用以下主题定制方式。

## 打包的样式表 {#bundled-stylesheet}

在应用入口处导入一次独立样式表。它包含所需的全部工具类和深色主题默认值。

```ts
import 'pptx-angular-viewer/styles';
// or: import 'pptx-angular-viewer/styles.css';
```

## `theme` 输入 {#the-theme-input}

最简单的方式是将 `ViewerTheme` 传入组件的 `theme` 输入。它会覆盖合并到内置深色默认值上，因此只需指定需要修改的部分。

```ts
import type { ViewerTheme } from 'pptx-angular-viewer';

@Component({
	template: `<pptx-viewer [content]="bytes" [theme]="theme" />`,
})
export class Example {
	readonly theme: ViewerTheme = {
		colors: { primary: '#6366f1', background: '#0f172a' },
		radius: '0.75rem',
	};
}
```

## 内置预设：朱红浅色与深色 {#built-in-presets-vermilion-light-dark}

React、Vue、Angular、Svelte 和原生 JavaScript 均提供两种主题，沿用本文档站的朱红配色：浅色模式呈现温暖的纸张风格，深色模式呈现较暗的放映室风格。

```ts
import { vermilionLightTheme, vermilionDarkTheme } from 'pptx-angular-viewer';
```

```html
<pptx-viewer [content]="bytes" [theme]="vermilionLightTheme" />
```

每个预设都是完整的 `ViewerTheme`，包含 19 个颜色项和 `0.375rem` 圆角，完整替换内置深色默认值。同时导出原始配色，方便派生自定义主题：

```ts
import { vermilionDarkColors, vermilionRadius } from 'pptx-angular-viewer';
import type { ViewerTheme } from 'pptx-angular-viewer';

const custom: ViewerTheme = {
	colors: { ...vermilionDarkColors, primary: '#38bdf8' },
	radius: vermilionRadius,
};
```

React、Vue、Svelte 和原生 JavaScript 包分别从 `pptx-react-viewer`、`pptx-vue-viewer`、`pptx-svelte-viewer` 和 `pptx-vanilla-viewer` 导出相同的五个符号。

## `ViewerTheme` 与 `ViewerThemeColors` {#viewertheme-and-viewerthemecolors}

```ts
import type { ViewerTheme, ViewerThemeColors } from 'pptx-angular-viewer';
```

所有字段均可选，未设置项回退到深色主题默认值。每个颜色键映射到 `--pptx-<kebab-key>` CSS 自定义属性。

```ts
interface ViewerTheme {
	/** Semantic UI colors. Each key maps to a --pptx-<key> custom property. */
	colors?: Partial<ViewerThemeColors>;
	/** Base border-radius value, e.g. "0.5rem", "8px". */
	radius?: string;
	/** Escape hatch: arbitrary CSS custom properties on the viewer root. Keys include the `--` prefix. */
	cssVars?: Record<string, string>;
}
```

五种绑定共享 `ViewerThemeColors` 的所有键，值均为 CSS 颜色字符串，可使用十六进制、`rgb()`、`hsl()`、`oklch()` 或命名颜色：`background`、`foreground`、`card`、`cardForeground`、`popover`、`popoverForeground`、`primary`、`primaryForeground`、`secondary`、`secondaryForeground`、`muted`、`mutedForeground`、`accent`、`accentForeground`、`destructive`、`destructiveForeground`、`border`、`input`、`ring`。

::: warning 完整类型与部分覆盖
`ViewerThemeColors` 中的所有键都是必填项，但 `theme.colors` 的类型是 `Partial<ViewerThemeColors>`，因此传给组件的颜色配置可以只包含任意子集。
:::

## 主题工具 {#theme-utilities}

```ts
import {
	defaultThemeColors, // full ViewerThemeColors dark-theme values
	defaultRadius, // "0.5rem"
	themeToCssVars, // (theme, omitDefaults?) => Record<string, string>
	defaultCssVars, // () => Record<string, string> of all --pptx-* defaults
	themeStyle, // (theme | undefined) => Record<string, string>, for [ngStyle]
	provideViewerTheme,
	VIEWER_THEME,
} from 'pptx-angular-viewer';
```

### `defaultThemeColors` 与 `defaultRadius` {#defaultthemecolors-and-defaultradius}

内置深色主题，采用 Tailwind 灰阶和靛蓝主色。`defaultRadius` 为 `'0.5rem'`。

```ts
const lightish: ViewerTheme = {
	colors: { ...defaultThemeColors, background: '#ffffff', foreground: '#0f172a' },
};
```

### `themeToCssVars(theme, omitDefaults?)` {#themetocssvars-theme-omitdefaults}

将 `ViewerTheme` 转换为由 `--pptx-*` 属性组成的扁平 `Record<string, string>`。颜色键转换为 kebab-case CSS 后缀，`radius` 变为 `--pptx-radius`，所有 `cssVars` 条目原样保留。`omitDefaults` 为 `true` 时会跳过与内置默认值相同的值，默认是 `false`。

### `themeStyle(theme)` {#themestyle-theme}

Angular 专用的 `themeToCssVars` 便捷包装，输入为 `undefined` 时返回 `{}`，可直接展开到 `[ngStyle]`。`PowerPointViewerComponent` 内部就是使用它将 `theme` 输入应用到根元素。

### `defaultCssVars()` {#defaultcssvars}

返回填入深色默认值的完整 `--pptx-*` 属性集合，可用于生成完整的回退样式表。

## `provideViewerTheme` 与 `VIEWER_THEME` {#provideviewertheme-and-viewer-theme}

对大多数应用而言，`theme` 输入已经足够。`provideViewerTheme` 是 Angular 基于依赖注入的高级入口，可在整个应用或子树中共享同一主题，对应 React 的 `ViewerThemeProvider` / `useViewerTheme` context 和 Vue 的 `provide` / `inject`。

```ts
import { provideViewerTheme } from 'pptx-angular-viewer';

bootstrapApplication(AppComponent, {
	providers: [provideViewerTheme({ colors: { primary: '#6366f1' } })],
});
```

可以在下方任何位置通过 `VIEWER_THEME` 注入令牌读取所提供的主题：

```ts
import { inject } from '@angular/core';
import { VIEWER_THEME } from 'pptx-angular-viewer';

@Component({/* ... */})
export class SomeChild {
	private readonly theme = inject(VIEWER_THEME, { optional: true }); // ViewerTheme | undefined
}
```

::: tip 提示
`provideViewerTheme` 只在依赖注入中注册值，不会自行在任何位置应用 CSS 变量。需要应用变量时，请使用 `themeToCssVars` 或 `themeStyle`，`theme` 输入在内部也采用相同方式。
:::

## 浅色主题示例 {#light-theme-example}

```ts
readonly theme: ViewerTheme = {
	colors: {
		background: '#ffffff',
		foreground: '#0f172a',
		card: '#f8fafc',
		cardForeground: '#0f172a',
		primary: '#4f46e5',
		primaryForeground: '#ffffff',
		muted: '#f1f5f9',
		mutedForeground: '#64748b',
		accent: '#f1f5f9',
		accentForeground: '#0f172a',
		border: '#e2e8f0',
		destructive: '#dc2626',
		destructiveForeground: '#ffffff',
	},
};
```
