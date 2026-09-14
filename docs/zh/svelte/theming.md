---
title: Svelte 查看器主题
description: 使用共享 ViewerTheme 系统定制 Svelte PowerPoint 查看器，包括调色板覆盖、边框圆角、原始 CSS 自定义属性、朱红色预设和内置主题选择器。
---

# 主题配置 {#theming}

Svelte 查看器使用与 React、Vue、Angular 和原生 JavaScript 绑定相同的 `ViewerTheme` 系统：具名颜色调色板、可选边框圆角和可选原始 CSS 自定义属性，全部作为 `--pptx-*` 变量应用于查看器根元素。

## 传入主题 {#passing-a-theme}

```svelte
<script lang="ts">
	import { PowerPointViewer, vermilionDarkTheme } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
</script>

<PowerPointViewer source={bytes} theme={vermilionDarkTheme} />
```

此属性是响应式的，赋予新主题对象会直接更新界面样式。

```svelte
<PowerPointViewer
	source={bytes}
	theme={{ colors: { background: '#0c1222', foreground: '#e2e8f0', primary: '#38bdf8' } }}
/>
```

所有值均可选：未设置的颜色回退为内置深色默认值 `defaultThemeColors`，圆角回退为 `defaultRadius`。

## `ViewerTheme` 结构 {#the-viewertheme-shape}

```ts
interface ViewerTheme {
	/** Partial palette; see ViewerThemeColors for all keys. */
	colors?: Partial<ViewerThemeColors>;
	/** Border radius for chrome surfaces, e.g. '0.5rem'. */
	radius?: string;
	/** Raw CSS custom properties, applied verbatim ('--pptx-foo': '...'). */
	cssVars?: Record<string, string>;
}
```

`ViewerThemeColors` 覆盖完整的界面调色板：`background`、`foreground`、`card`、`popover`、`primary`、`secondary`、`muted`、`accent`、`destructive`，各颜色具有对应的 `*Foreground`，另有 `border`、`input` 和 `ring`。

## 预设与辅助函数 {#presets-and-helpers}

以下内容均从包根入口导出：

| 导出项                                         | 说明                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `vermilionLightTheme` / `vermilionDarkTheme`   | 各绑定共享的文档品牌亮色和深色预设。                                       |
| `vermilionLightColors` / `vermilionDarkColors` | 仅包含这些预设的调色板。                                                   |
| `vermilionRadius`                              | 预设的边框圆角。                                                           |
| `defaultThemeColors`, `defaultRadius`          | 内置回退调色板和圆角。                                                     |
| `themeToCssVars(theme)`                        | 将主题解析为最终的 `--pptx-*` 变量映射，可用于为查看器周围的界面设置样式。 |
| `defaultCssVars()`                             | 完整的默认变量映射。                                                       |

## 内置主题选择器 {#theme-picker}

查看器提供面向用户的主题选择器，位于设计选项卡和“文件 > 选项 > 外观”，由三个属性驱动：

| 属性              | 类型                           | 说明                                                                                                  |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `defaultThemeKey` | `string`                       | 初始选择，对应 `availableThemes` 中的键。回退为 `localStorage` 中持久化的选择，再回退为 `'default'`。 |
| `availableThemes` | `readonly ThemeCatalogEntry[]` | 可供选择的选项，默认为内置目录：`default`、`light`、`vermilionLight`、`vermilionDark`。               |
| `onThemeChange`   | `(themeKey: string) => void`   | 携带选中的键触发。提供此回调后由宿主管理持久化；不提供时，选择会自动存储到 `localStorage`。           |

```ts
interface ThemeCatalogEntry {
	/** Stable identifier persisted to storage and passed to onThemeChange. */
	key: string;
	/** pptx.* translation key for the entry's display label. */
	labelKey: string;
	/** The theme to apply, or undefined to reset to the built-in default. */
	theme: ViewerTheme | undefined;
}
```

::: tip `theme` 与选择器之间的优先级
用户选择目录条目后，该键在剩余会话中决定实际主题。解析后的键为 `'default'` 时（该条目映射到 `undefined`），`theme` 属性仍然生效，因此宿主提供的主题仍是开箱即用的默认外观。
:::

## 让宿主界面样式保持一致 {#styling-host-chrome-to-match}

`themeToCssVars` 可以让周围界面跟随当前主题：

```ts
import { themeToCssVars, vermilionDarkTheme } from 'pptx-svelte-viewer';

for (const [key, value] of Object.entries(themeToCssVars(vermilionDarkTheme))) {
	document.documentElement.style.setProperty(key, value);
}
```

之后，你自己的元素就可以使用 `var(--pptx-background)`、`var(--pptx-primary)` 等变量，[Svelte 演示](https://christophervr.github.io/pptx-viewer/demo-svelte/)的起始页面也采用相同方式。

## 查看器 CSS {#viewer-css}

组件的结构样式是构建时生成的样式表，不在运行时注入。请导入一次，参见[快速上手](/zh/svelte/getting-started#install)：

```ts
import 'pptx-svelte-viewer/styles.css';
```

该样式表中的所有界面颜色都通过本页介绍的 `--pptx-*` 自定义属性解析，因此设置主题无需直接覆盖 CSS 规则。
