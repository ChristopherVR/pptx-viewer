---
title: Theming
description: Customise the viewer with the ViewerTheme type, defaultThemeColors, themeToCssVars, ViewerThemeProvider, and the --pptx-* CSS custom properties.
---

# Theming

The viewer's UI is built from utility classes that reference **CSS custom properties** (`--pptx-*`)
for every visual token. This means you can theme it three ways, in increasing order of control.

## Three styling modes

### Mode 1 - Tailwind CSS v4 project (no extra setup)

If your app already uses Tailwind CSS v4 with the shadcn-style semantic tokens, the viewer's classes
resolve through your existing config. No CSS import needed. Override specific values with the
[`theme` prop](#the-theme-prop).

### Mode 2 - bundled stylesheet

If you do not use Tailwind, import the self-contained stylesheet once at your entry point. It ships
all required utility classes plus dark-theme defaults.

```tsx
import 'pptx-react-viewer/styles';
// or: import 'pptx-react-viewer/styles.css';
```

### Mode 3 - raw CSS custom properties

For full control, define the `--pptx-*` properties yourself and skip both the bundled CSS and the
`theme` prop:

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
	/* …see defaultCssVars() for the complete list */
}
```

## The `theme` prop

The simplest path is to pass a `ViewerTheme` to the component. It is merged over the built-in dark
defaults, so you only override what you need.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';

<PowerPointViewer
	content={bytes}
	theme={{
		colors: { primary: '#6366f1', background: '#0f172a' },
		radius: '0.75rem',
	}}
/>;
```

## `ViewerTheme` and `ViewerThemeColors`

```ts
import type { ViewerTheme, ViewerThemeColors } from 'pptx-react-viewer';
```

Every field is optional; unset values fall back to the dark-theme defaults. Each color key maps to a
`--pptx-<kebab-key>` CSS custom property.

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

`ViewerThemeColors` keys (all CSS color strings - hex, `rgb()`, `hsl()`, `oklch()`, named):

| Key                     | CSS variable                    | Role                            |
| ----------------------- | ------------------------------- | ------------------------------- |
| `background`            | `--pptx-background`             | Page / root background          |
| `foreground`            | `--pptx-foreground`             | Default text color              |
| `card`                  | `--pptx-card`                   | Card / panel surface            |
| `cardForeground`        | `--pptx-card-foreground`        | Text on card surfaces           |
| `popover`               | `--pptx-popover`                | Popover / dropdown surface      |
| `popoverForeground`     | `--pptx-popover-foreground`     | Text inside popovers            |
| `primary`               | `--pptx-primary`                | Primary action color            |
| `primaryForeground`     | `--pptx-primary-foreground`     | Text on primary backgrounds     |
| `secondary`             | `--pptx-secondary`              | Secondary action color          |
| `secondaryForeground`   | `--pptx-secondary-foreground`   | Text on secondary backgrounds   |
| `muted`                 | `--pptx-muted`                  | Muted / disabled surface        |
| `mutedForeground`       | `--pptx-muted-foreground`       | Secondary / muted text          |
| `accent`                | `--pptx-accent`                 | Hover-highlight surface         |
| `accentForeground`      | `--pptx-accent-foreground`      | Text on accent surfaces         |
| `destructive`           | `--pptx-destructive`            | Danger / delete color           |
| `destructiveForeground` | `--pptx-destructive-foreground` | Text on destructive backgrounds |
| `border`                | `--pptx-border`                 | Default border color            |
| `input`                 | `--pptx-input`                  | Input field border              |
| `ring`                  | `--pptx-ring`                   | Focus ring color                |

::: warning Required-vs-partial
On `ViewerThemeColors` all keys are required, but the `theme.colors` field is typed
`Partial<ViewerThemeColors>` - so when you pass colors to the component you can supply any subset.
:::

## Theme utilities

```ts
import {
	defaultThemeColors, // full ViewerThemeColors dark-theme values
	defaultRadius, // "0.5rem"
	themeToCssVars, // (theme, omitDefaults?) => Record<string, string>
	defaultCssVars, // () => Record<string, string> of all --pptx-* defaults
	ViewerThemeProvider,
	useViewerTheme,
} from 'pptx-react-viewer';
```

### `defaultThemeColors` and `defaultRadius`

The built-in dark theme (Tailwind gray scale + indigo primary). `defaultRadius` is `'0.5rem'`. Read
them when you want to derive a theme from the defaults:

```ts
const lightish: ViewerTheme = {
	colors: { ...defaultThemeColors, background: '#ffffff', foreground: '#0f172a' },
};
```

### `themeToCssVars(theme, omitDefaults?)`

Converts a `ViewerTheme` into a flat `Record<string, string>` of `--pptx-*` properties, ready to
spread onto a `style` attribute. Color keys are mapped to their kebab-case CSS suffix, `radius`
becomes `--pptx-radius`, and any `cssVars` entries pass through verbatim. When `omitDefaults` is
`true`, values equal to the built-in defaults are skipped (default is `false`).

```ts
const style = themeToCssVars({ colors: { primary: '#6366f1' }, radius: '0.75rem' });
// { '--pptx-primary': '#6366f1', '--pptx-radius': '0.75rem' }
```

### `defaultCssVars()`

Returns the complete set of `--pptx-*` properties populated with the dark-theme defaults - useful for
generating a full fallback stylesheet.

## `ViewerThemeProvider` and `useViewerTheme`

For most apps the `theme` prop is enough. The provider is an advanced escape hatch for sharing one
theme across multiple viewers or a wider subtree.

```tsx
import { ViewerThemeProvider, useViewerTheme } from 'pptx-react-viewer';

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<ViewerThemeProvider theme={{ colors: { primary: '#6366f1' } }}>{children}</ViewerThemeProvider>
	);
}

// Anywhere below the provider:
function SomeChild() {
	const theme = useViewerTheme(); // ViewerTheme | undefined
	// …
}
```

::: tip
`useViewerTheme()` returns the nearest provided `ViewerTheme` (or `undefined`). It reads context only
: it does not produce the CSS variables. Use `themeToCssVars` for that.
:::

## Light theme example

```tsx
<PowerPointViewer
	content={bytes}
	theme={{
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
	}}
/>
```
