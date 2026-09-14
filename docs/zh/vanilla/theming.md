---
title: 原生 JavaScript 查看器主题
description: 使用共享 ViewerTheme 系统定制无需框架的 PowerPoint 查看器，包括调色板覆盖、边框圆角、原始 CSS 自定义属性和朱红色预设。
---

# 主题配置 {#theming}

原生 JavaScript 查看器使用与 React、Vue、Angular 和 Svelte 绑定相同的 `ViewerTheme` 系统：具名颜色调色板、可选边框圆角和可选原始 CSS 自定义属性，全部作为 `--pptx-*` 变量应用于查看器根元素。

## 传入主题 {#passing-a-theme}

```ts
import { createPptxViewer, vermilionDarkTheme } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(host, {
	source: '/deck.pptx',
	theme: vermilionDarkTheme,
});

// Swap at runtime; the chrome restyles in place.
viewer.setTheme({
	colors: { background: '#0c1222', foreground: '#e2e8f0', primary: '#38bdf8' },
});

// Reset to the built-in defaults.
viewer.setTheme(undefined);
```

所有值均可选：未设置的颜色回退为内置深色默认值 `defaultThemeColors`，圆角回退为 `defaultRadius`（`'0.5rem'`）。

颜色值接受任何有效的 CSS 颜色字符串，例如十六进制 `#6366f1`、`rgb(99 102 241)`、`hsl(239 84% 67%)`、`oklch(0.585 0.233 277)`、命名颜色等。

## `ViewerTheme` 结构 {#the-viewertheme-shape}

```ts
interface ViewerTheme {
	/** Semantic UI colors. Each key maps to a `--pptx-<key>` CSS custom property. */
	colors?: Partial<ViewerThemeColors>;
	/** Base border-radius value (e.g. '0.5rem', '8px'). */
	radius?: string;
	/**
	 * Escape hatch: arbitrary CSS custom properties to set on the viewer root.
	 * Keys should include the `--` prefix.
	 */
	cssVars?: Record<string, string>;
}
```

### `ViewerThemeColors` {#viewerthemecolors}

完整的界面调色板遵循 shadcn/ui 命名约定。通过 `ViewerTheme.colors` 传入时，每个键均可选；下方默认值来自内置深色调色板 `defaultThemeColors`：

| 键                      | CSS 变量                        | 默认值    | 用途                           |
| ----------------------- | ------------------------------- | --------- | ------------------------------ |
| `background`            | `--pptx-background`             | `#030712` | 页面和根元素背景               |
| `foreground`            | `--pptx-foreground`             | `#f3f4f6` | 默认文字颜色                   |
| `card`                  | `--pptx-card`                   | `#111827` | 卡片和面板背景                 |
| `cardForeground`        | `--pptx-card-foreground`        | `#f3f4f6` | 卡片文本                       |
| `popover`               | `--pptx-popover`                | `#111827` | 弹出层和下拉菜单背景           |
| `popoverForeground`     | `--pptx-popover-foreground`     | `#f3f4f6` | 弹出层文本                     |
| `primary`               | `--pptx-primary`                | `#6366f1` | 主要操作，例如按钮和活动指示器 |
| `primaryForeground`     | `--pptx-primary-foreground`     | `#ffffff` | 主要操作背景上的文本           |
| `secondary`             | `--pptx-secondary`              | `#1f2937` | 次要或弱化的操作               |
| `secondaryForeground`   | `--pptx-secondary-foreground`   | `#f3f4f6` | 次要操作背景上的文本           |
| `muted`                 | `--pptx-muted`                  | `#1f2937` | 弱化和禁用状态背景             |
| `mutedForeground`       | `--pptx-muted-foreground`       | `#9ca3af` | 次要文本                       |
| `accent`                | `--pptx-accent`                 | `#1f2937` | 悬停高亮背景                   |
| `accentForeground`      | `--pptx-accent-foreground`      | `#f3f4f6` | 高亮背景上的文本               |
| `destructive`           | `--pptx-destructive`            | `#ef4444` | 破坏性或危险操作               |
| `destructiveForeground` | `--pptx-destructive-foreground` | `#ffffff` | 危险操作背景上的文本           |
| `border`                | `--pptx-border`                 | `#374151` | 默认边框                       |
| `input`                 | `--pptx-input`                  | `#374151` | 输入框边框                     |
| `ring`                  | `--pptx-ring`                   | `#6366f1` | 焦点环                         |

`radius` 映射到 `--pptx-radius`，默认 `0.5rem`。

::: tip Tailwind 用户
`themeToCssVars` 还会将每种颜色输出为 `--color-<key>` 变量，并根据圆角推导 `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl`，因此 Tailwind v4 的 `@theme` 令牌也会跟随当前查看器主题。
:::

## 预设与辅助函数 {#presets-and-helpers}

以下内容均从 `pptx-vanilla-viewer` 包根入口导出：

| 导出项                                       | 说明                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `vermilionLightTheme` / `vermilionDarkTheme` | 各绑定共享的文档品牌亮色和深色预设，见下文。                                                         |
| `defaultThemeColors`, `defaultRadius`        | 内置回退调色板（深色主题）和圆角（`'0.5rem'`）。                                                     |
| `themeToCssVars(theme, omitDefaults?)`       | 将主题解析为最终的 `--pptx-*` 变量映射，可用于为查看器*周围*的界面设置样式，例如演示中的文件拖放区。 |
| `defaultCssVars()`                           | 完整的默认 `--pptx-*` 变量映射，包含所有键。                                                         |

### 朱红色预设 {#the-vermilion-presets}

两个预设都设置了全部 `ViewerThemeColors` 键，以及 `radius: '0.375rem'`，比默认圆角略小。主要差异如下：

| 令牌         | `vermilionLightTheme`     | `vermilionDarkTheme`      |
| ------------ | ------------------------- | ------------------------- |
| `background` | `#fbfaf7`（暖纸色）       | `#0f1113`（放映室深色）   |
| `foreground` | `#1a1d21`                 | `#f0efec`                 |
| `primary`    | `#c2431f`（朱红色）       | `#e86a40`（明亮朱红色）   |
| `accent`     | `rgba(194, 67, 31, 0.08)` | `rgba(232, 106, 64, 0.1)` |
| `border`     | `#e6e2d9`                 | `#272c33`                 |

## 运行时切换主题 {#runtime-theme-switching}

`setTheme(theme)` 将解析后的变量作为内联自定义属性应用到查看器根元素，同时移除上一主题设置的值，因此切换即时生效，无需重建 DOM。`setTheme(undefined)` 清除全部覆盖值，恢复样式表默认值。

查看器界面也有内置选择器，位于“文件 > 选项 > 外观”，由 `createPptxViewer` 的两个相关选项支持：

- `availableThemes`：选择器提供的 `{ key, labelKey, theme }` 条目目录，默认内置四项：`default`（重置）、`light`、`vermilionLight` 和 `vermilionDark`。
- `onThemeChange(key)`：携带选中条目的 `key` 触发。提供回调后由宿主持久化选择；否则查看器会自动保存到 `localStorage` 的 `pptx-viewer-prefs` 中。

两者请参见[选项与回调](/zh/vanilla/options#theming--localization)。

## 让宿主界面样式保持一致 {#styling-host-chrome-to-match}

`themeToCssVars` 可以让周围界面跟随当前主题：

```ts
import { themeToCssVars } from 'pptx-vanilla-viewer';

for (const [key, value] of Object.entries(themeToCssVars(theme))) {
	document.documentElement.style.setProperty(key, value);
}
```

之后，你自己的元素可以使用 `var(--pptx-background)`、`var(--pptx-primary)` 等变量，[演示应用](https://christophervr.github.io/pptx-viewer/demo-vanilla/)的起始页面和悬浮选择器也采用相同方式。

默认情况下，`themeToCssVars` 输出主题设置的每个值；将 `omitDefaults: true` 作为第二个参数传入，则只输出与内置默认值不同的部分。

## 查看器 CSS {#viewer-css}

查看器自动注入样式表，使用单个 `<style>` 标签，并在实例之间去重。严格 CSP 宿主可导入 `pptx-vanilla-viewer/styles.css`，或通过 [`getViewerCss()`](/zh/vanilla/getting-started#csp-strict-hosts-getviewercss) 自行管理 CSS 文本。
