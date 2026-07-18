---
title: Vanilla JS Viewer Theming
description: Theme the zero-framework PowerPoint viewer with the shared ViewerTheme system - palette overrides, border radius, raw CSS custom properties, and the vermilion presets.
---

# Theming

The vanilla viewer uses the same `ViewerTheme` system as the React, Vue, Angular, and Svelte bindings:
a palette of named colors, an optional border radius, and optional raw CSS custom properties,
all applied as `--pptx-*` variables on the viewer root.

## Passing a theme

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

Every value is optional: unset colors fall back to the built-in dark defaults
(`defaultThemeColors`), and radius falls back to `defaultRadius` (`'0.5rem'`).

Color values accept any valid CSS color string: hex (`#6366f1`), `rgb(99 102 241)`,
`hsl(239 84% 67%)`, `oklch(0.585 0.233 277)`, named colors, and so on.

## The `ViewerTheme` shape

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

### `ViewerThemeColors`

The full chrome palette, following the shadcn/ui naming convention. Every key is
optional when passed through `ViewerTheme.colors`; the defaults below are the
built-in dark palette (`defaultThemeColors`):

| Key                     | CSS variable                    | Default   | Used for                                    |
| ----------------------- | ------------------------------- | --------- | ------------------------------------------- |
| `background`            | `--pptx-background`             | `#030712` | Page / root background                      |
| `foreground`            | `--pptx-foreground`             | `#f3f4f6` | Default text color                          |
| `card`                  | `--pptx-card`                   | `#111827` | Card / panel surface                        |
| `cardForeground`        | `--pptx-card-foreground`        | `#f3f4f6` | Text on card surfaces                       |
| `popover`               | `--pptx-popover`                | `#111827` | Popover / dropdown surface                  |
| `popoverForeground`     | `--pptx-popover-foreground`     | `#f3f4f6` | Text inside popovers                        |
| `primary`               | `--pptx-primary`                | `#6366f1` | Primary actions (buttons, active indicator) |
| `primaryForeground`     | `--pptx-primary-foreground`     | `#ffffff` | Text on primary backgrounds                 |
| `secondary`             | `--pptx-secondary`              | `#1f2937` | Secondary / subdued actions                 |
| `secondaryForeground`   | `--pptx-secondary-foreground`   | `#f3f4f6` | Text on secondary backgrounds               |
| `muted`                 | `--pptx-muted`                  | `#1f2937` | Muted / disabled surface                    |
| `mutedForeground`       | `--pptx-muted-foreground`       | `#9ca3af` | Secondary text                              |
| `accent`                | `--pptx-accent`                 | `#1f2937` | Hover-highlight surface                     |
| `accentForeground`      | `--pptx-accent-foreground`      | `#f3f4f6` | Text on accent surfaces                     |
| `destructive`           | `--pptx-destructive`            | `#ef4444` | Destructive / danger actions                |
| `destructiveForeground` | `--pptx-destructive-foreground` | `#ffffff` | Text on destructive backgrounds             |
| `border`                | `--pptx-border`                 | `#374151` | Default border color                        |
| `input`                 | `--pptx-input`                  | `#374151` | Input field borders                         |
| `ring`                  | `--pptx-ring`                   | `#6366f1` | Focus ring                                  |

`radius` maps to `--pptx-radius` (default `0.5rem`).

::: tip Tailwind users
`themeToCssVars` additionally emits each color as a `--color-<key>` variable and
derives `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` from the
radius, so Tailwind v4 `@theme` tokens track the active viewer theme too.
:::

## Presets and helpers

Everything below is exported from the `pptx-vanilla-viewer` package root:

| Export                                       | What it is                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `vermilionLightTheme` / `vermilionDarkTheme` | The docs-brand light/dark presets shared by every binding (see below).                                                         |
| `defaultThemeColors`, `defaultRadius`        | The built-in fallback palette (a dark theme) and radius (`'0.5rem'`).                                                          |
| `themeToCssVars(theme, omitDefaults?)`       | Resolve a theme to its final `--pptx-*` variable map. Useful for styling chrome _around_ the viewer (see the demo's dropzone). |
| `defaultCssVars()`                           | The full default `--pptx-*` variable map, all keys included.                                                                   |

### The vermilion presets

Both presets set every `ViewerThemeColors` key plus `radius: '0.375rem'` (slightly
sharper than the default). Highlights:

| Token        | `vermilionLightTheme`     | `vermilionDarkTheme`         |
| ------------ | ------------------------- | ---------------------------- |
| `background` | `#fbfaf7` (warm paper)    | `#0f1113` (presenter room)   |
| `foreground` | `#1a1d21`                 | `#f0efec`                    |
| `primary`    | `#c2431f` (vermilion)     | `#e86a40` (lifted vermilion) |
| `accent`     | `rgba(194, 67, 31, 0.08)` | `rgba(232, 106, 64, 0.1)`    |
| `border`     | `#e6e2d9`                 | `#272c33`                    |

## Runtime theme switching

`setTheme(theme)` applies the resolved variables as inline custom properties on the
viewer root (removing whatever the previous theme set), so switching is instant and
does not rebuild the DOM. `setTheme(undefined)` clears every override back to the
stylesheet defaults.

The viewer chrome also has a built-in picker (File > Options > Appearance) backed by
two related options on `createPptxViewer`:

- `availableThemes`: the catalog of `{ key, labelKey, theme }` entries offered by the
  picker. Defaults to a built-in catalog of four entries: `default` (reset),
  `light`, `vermilionLight`, and `vermilionDark`.
- `onThemeChange(key)`: fired with the selected entry's `key`. When supplied, the
  host owns persisting the choice; otherwise the viewer persists it to
  `localStorage` under `pptx-viewer-prefs` automatically.

See [Options & Callbacks](/vanilla/options#theming--localization) for both.

## Styling host chrome to match

`themeToCssVars` lets surrounding UI track the active theme:

```ts
import { themeToCssVars } from 'pptx-vanilla-viewer';

for (const [key, value] of Object.entries(themeToCssVars(theme))) {
	document.documentElement.style.setProperty(key, value);
}
```

Your own elements can then use `var(--pptx-background)`, `var(--pptx-primary)`, and friends,
exactly as the [demo app](https://christophervr.github.io/pptx-viewer/demo-vanilla/) does for
its landing screen and floating pickers.

By default `themeToCssVars` emits every value the theme sets; pass `omitDefaults: true`
as the second argument to emit only values that differ from the built-in defaults.

## Viewer CSS

The viewer injects its stylesheet automatically (a single `<style>` tag, deduplicated across
instances). For CSP-strict hosts, import `pptx-vanilla-viewer/styles.css`, or manage the CSS
text via [`getViewerCss()`](/vanilla/getting-started#csp-strict-hosts-getviewercss).
