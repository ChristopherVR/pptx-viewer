---
title: 主题
description: 使用 ViewerTheme 类型、defaultThemeColors、themeToCssVars、provideViewerTheme/useViewerTheme 和 --pptx-* CSS 自定义属性定制查看器。
---

# 主题配置 {#theming}

查看器界面由工具类构建，每个视觉令牌都引用 **CSS 自定义属性**（`--pptx-*`），与 React 和 Angular 绑定遵循相同约定。因此可以按控制程度从低到高采用三种主题定制方式。

## 三种样式接入方式 {#three-styling-modes}

### 方式 1：Tailwind CSS v4 项目 {#mode-1-tailwind-css-v4-project-no-extra-setup}

如果应用已经使用 Tailwind CSS v4 和 shadcn 风格的语义变量，组件类名会直接使用现有配置，无需导入 CSS。需要覆盖部分值时，使用 [`theme` 属性](#the-theme-prop)。

### 方式 2：随包提供的样式表 {#mode-2-bundled-stylesheet}

不使用 Tailwind 时，在入口导入一次自包含样式表。它提供所需的工具类和深色主题默认值。

```ts
import 'pptx-vue-viewer/styles';
// or: import 'pptx-vue-viewer/styles.css';
```

### 方式 3：直接配置 CSS 自定义属性 {#mode-3-raw-css-custom-properties}

需要完全控制时，可以自行定义 `--pptx-*`，不使用随包样式表和 `theme` 属性：

```css
:root {
	--pptx-background: #030712;
	--pptx-foreground: #f3f4f6;
	--pptx-primary: #6366f1;
	--pptx-primary-foreground: #ffffff;
	--pptx-card: #111827;
	--pptx-border: #374151;
	--pptx-ring: #6366f1;
	--pptx-radius: 0.5rem;
	/* ...see defaultCssVars() for the complete list */
}
```

## `theme` 属性 {#the-theme-prop}

最简单的方式是向组件传入 `ViewerTheme`。它会与内置深色默认值合并，只需覆盖需要修改的项。

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
</script>

<template>
	<PowerPointViewer
		:content="bytes"
		:theme="{ colors: { primary: '#6366f1', background: '#0f172a' }, radius: '0.75rem' }"
	/>
</template>
```

## 内置预设：朱红浅色与深色 {#built-in-presets-vermilion-light-dark}

React、Vue、Angular、Svelte 和原生 JavaScript 均提供两种主题，沿用本文档站的朱红配色：浅色模式呈现温暖的纸张风格，深色模式呈现较暗的放映室风格。

```vue
<script setup lang="ts">
import { PowerPointViewer, vermilionLightTheme, vermilionDarkTheme } from 'pptx-vue-viewer';
</script>

<template>
	<PowerPointViewer :content="bytes" :theme="vermilionLightTheme" />
</template>
```

每个预设都是完整的 `ViewerTheme`，包含 19 个颜色项和 `0.375rem` 圆角，完整替换内置深色默认值。同时导出原始配色，方便派生自定义主题：

```ts
import { vermilionLightColors, vermilionDarkColors, vermilionRadius } from 'pptx-vue-viewer';
import type { ViewerTheme } from 'pptx-vue-viewer';

const custom: ViewerTheme = {
	colors: { ...vermilionDarkColors, primary: '#38bdf8' },
	radius: vermilionRadius,
};
```

React 和 Angular 包分别从 `pptx-react-viewer` 和 `pptx-angular-viewer` 导出相同的五个符号。

## `ViewerTheme` 与 `ViewerThemeColors` {#viewertheme-and-viewerthemecolors}

```ts
import type { ViewerTheme, ViewerThemeColors } from 'pptx-vue-viewer';
```

两个类型都定义在 `pptx-viewer-shared`，并由 `pptx-vue-viewer`（通过 `./theme`）重新导出，因此各绑定的定义完全一致。每个字段均可选，未设置的值回退为深色主题默认值。每个颜色键映射到 `--pptx-<kebab-key>` CSS 自定义属性。

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

`ViewerThemeColors` 的键如下，值均为 CSS 颜色字符串，可使用十六进制、`rgb()`、`hsl()`、`oklch()` 或命名颜色：

| 键                      | CSS 变量                        | 用途                 |
| ----------------------- | ------------------------------- | -------------------- |
| `background`            | `--pptx-background`             | 页面和根元素背景     |
| `foreground`            | `--pptx-foreground`             | 默认文字颜色         |
| `card`                  | `--pptx-card`                   | 卡片和面板背景       |
| `cardForeground`        | `--pptx-card-foreground`        | 卡片文本             |
| `popover`               | `--pptx-popover`                | 弹出层和下拉菜单背景 |
| `popoverForeground`     | `--pptx-popover-foreground`     | 弹出层文本           |
| `primary`               | `--pptx-primary`                | 主要操作颜色         |
| `primaryForeground`     | `--pptx-primary-foreground`     | 主要操作背景上的文本 |
| `secondary`             | `--pptx-secondary`              | 次要操作颜色         |
| `secondaryForeground`   | `--pptx-secondary-foreground`   | 次要操作背景上的文本 |
| `muted`                 | `--pptx-muted`                  | 弱化和禁用状态背景   |
| `mutedForeground`       | `--pptx-muted-foreground`       | 次要和弱化文本       |
| `accent`                | `--pptx-accent`                 | 悬停高亮背景         |
| `accentForeground`      | `--pptx-accent-foreground`      | 高亮背景上的文本     |
| `destructive`           | `--pptx-destructive`            | 危险和删除操作颜色   |
| `destructiveForeground` | `--pptx-destructive-foreground` | 危险操作背景上的文本 |
| `border`                | `--pptx-border`                 | 默认边框             |
| `input`                 | `--pptx-input`                  | 输入框边框           |
| `ring`                  | `--pptx-ring`                   | 焦点环               |

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
	provideViewerTheme,
	useViewerTheme,
	useThemeStyle,
} from 'pptx-vue-viewer';
```

### `defaultThemeColors` 与 `defaultRadius` {#defaultthemecolors-and-defaultradius}

内置深色主题使用 Tailwind 灰阶和靛蓝主色，`defaultRadius` 为 `'0.5rem'`。需要从默认主题派生时可读取它们：

```ts
const lightish: ViewerTheme = {
	colors: { ...defaultThemeColors, background: '#ffffff', foreground: '#0f172a' },
};
```

### `themeToCssVars(theme, omitDefaults?)` {#themetocssvars-theme-omitdefaults}

将 `ViewerTheme` 转换为由 `--pptx-*` 属性组成的扁平 `Record<string, string>`，可直接展开到 `:style` 绑定。颜色键转换为 kebab-case CSS 后缀，`radius` 变为 `--pptx-radius`，所有 `cssVars` 条目原样保留。`omitDefaults` 为 `true` 时会跳过与内置默认值相同的值，默认是 `false`。

```ts
const style = themeToCssVars({ colors: { primary: '#6366f1' }, radius: '0.75rem' });
// { '--pptx-primary': '#6366f1', '--pptx-radius': '0.75rem' }
```

### `defaultCssVars()` {#defaultcssvars}

返回完整的 `--pptx-*` 属性集合，填入深色主题默认值，可用于生成完整的回退样式表。

## `provideViewerTheme` 与 `useViewerTheme` {#provideviewertheme-and-useviewertheme}

对大多数应用而言，`theme` 属性已经足够。`provideViewerTheme` / `useViewerTheme` 是 React `ViewerThemeProvider` / `useViewerTheme` context 对应的 Vue `provide` / `inject` 实现，适合在多个查看器或更大的子树之间共享主题等高级场景。

```vue
<script setup lang="ts">
import { provideViewerTheme, useViewerTheme } from 'pptx-vue-viewer';
import { ref } from 'vue';

const theme = ref({ colors: { primary: '#6366f1' } });
provideViewerTheme(theme);
</script>
```

```vue
<script setup lang="ts">
// Anywhere below the provideViewerTheme call:
import { useViewerTheme } from 'pptx-vue-viewer';

const theme = useViewerTheme(); // ComputedRef<ViewerTheme | undefined>
</script>
```

::: tip 提示
`useViewerTheme()` 返回 `ComputedRef`，其中是最近一层提供的 `ViewerTheme`，或 `undefined`。它只读取注入值，不会生成 CSS 变量。需要生成变量时，请使用 `useThemeStyle`（`PowerPointViewer` 内部使用）或 `themeToCssVars`。
:::

## 浅色主题示例 {#light-theme-example}

```vue
<template>
	<PowerPointViewer
		:content="bytes"
		:theme="{
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
		}"
	/>
</template>
```
