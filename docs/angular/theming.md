---
title: Theming
description: Customise the viewer with the ViewerTheme type, defaultThemeColors, themeToCssVars, provideViewerTheme, and the --pptx-* CSS custom properties.
---

# Theming

The viewer's UI is built from utility classes that reference **CSS custom properties** (`--pptx-*`)
for every visual token, exactly like the React and Vue bindings. This means you can theme it in a
few ways, in increasing order of control.

## Bundled stylesheet

Import the self-contained stylesheet once at your app's entry point. It ships all required utility
classes plus dark-theme defaults.

```ts
import 'pptx-angular-viewer/styles';
// or: import 'pptx-angular-viewer/styles.css';
```

## The `theme` input

The simplest path is to pass a `ViewerTheme` to the component's `theme` input. It is merged over the
built-in dark defaults, so you only override what you need.

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

## Built-in presets: vermilion light & dark

Two ready-made themes ship with every binding (React, Vue, Angular). They carry the same vermilion
brand as this documentation site: a warm paper canvas in light mode, a dimmed presenter room in
dark mode.

```ts
import { vermilionLightTheme, vermilionDarkTheme } from 'pptx-angular-viewer';
```

```html
<pptx-viewer [content]="bytes" [theme]="vermilionLightTheme" />
```

Each preset is a complete `ViewerTheme` (all 19 color tokens plus a `0.375rem` radius), so it fully
replaces the built-in dark defaults. The raw palettes are exported alongside for deriving your own
variant:

```ts
import { vermilionDarkColors, vermilionRadius } from 'pptx-angular-viewer';
import type { ViewerTheme } from 'pptx-angular-viewer';

const custom: ViewerTheme = {
	colors: { ...vermilionDarkColors, primary: '#38bdf8' },
	radius: vermilionRadius,
};
```

The React and Vue packages export the same five symbols from `pptx-react-viewer` and
`pptx-vue-viewer`.

## `ViewerTheme` and `ViewerThemeColors`

```ts
import type { ViewerTheme, ViewerThemeColors } from 'pptx-angular-viewer';
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

`ViewerThemeColors` keys (all CSS color strings - hex, `rgb()`, `hsl()`, `oklch()`, named) are shared
across all three bindings: `background`, `foreground`, `card`, `cardForeground`, `popover`,
`popoverForeground`, `primary`, `primaryForeground`, `secondary`, `secondaryForeground`, `muted`,
`mutedForeground`, `accent`, `accentForeground`, `destructive`, `destructiveForeground`, `border`,
`input`, `ring`.

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
	themeStyle, // (theme | undefined) => Record<string, string>, for [ngStyle]
	provideViewerTheme,
	VIEWER_THEME,
} from 'pptx-angular-viewer';
```

### `defaultThemeColors` and `defaultRadius`

The built-in dark theme (Tailwind gray scale + indigo primary). `defaultRadius` is `'0.5rem'`.

```ts
const lightish: ViewerTheme = {
	colors: { ...defaultThemeColors, background: '#ffffff', foreground: '#0f172a' },
};
```

### `themeToCssVars(theme, omitDefaults?)`

Converts a `ViewerTheme` into a flat `Record<string, string>` of `--pptx-*` properties. Color keys
are mapped to their kebab-case CSS suffix, `radius` becomes `--pptx-radius`, and any `cssVars`
entries pass through verbatim. When `omitDefaults` is `true`, values equal to the built-in defaults
are skipped (default is `false`).

### `themeStyle(theme)`

Angular-specific convenience wrapper around `themeToCssVars` that returns `{}` for `undefined`,
ready to spread onto `[ngStyle]`. This is what `PowerPointViewerComponent` itself uses internally to
apply the `theme` input to its root element.

### `defaultCssVars()`

Returns the complete set of `--pptx-*` properties populated with the dark-theme defaults - useful
for generating a full fallback stylesheet.

## `provideViewerTheme` and `VIEWER_THEME`

For most apps the `theme` input is enough. `provideViewerTheme` is Angular's DI-based escape hatch
for sharing one theme app-wide or across a subtree, mirroring React's `ViewerThemeProvider` /
`useViewerTheme` context and Vue's `provide`/`inject`.

```ts
import { provideViewerTheme } from 'pptx-angular-viewer';

bootstrapApplication(AppComponent, {
	providers: [provideViewerTheme({ colors: { primary: '#6366f1' } })],
});
```

Read the provided theme anywhere below with the `VIEWER_THEME` injection token:

```ts
import { inject } from '@angular/core';
import { VIEWER_THEME } from 'pptx-angular-viewer';

@Component({/* ... */})
export class SomeChild {
	private readonly theme = inject(VIEWER_THEME, { optional: true }); // ViewerTheme | undefined
}
```

::: tip
`provideViewerTheme` only registers the value in DI; it does not apply CSS variables anywhere by
itself. Use `themeToCssVars` or `themeStyle` for that, the same as the `theme` input does
internally.
:::

## Light theme example

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
