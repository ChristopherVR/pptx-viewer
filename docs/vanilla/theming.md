---
title: Vanilla JS Viewer Theming
description: Theme the zero-framework PowerPoint viewer with the shared ViewerTheme system - palette overrides, border radius, raw CSS custom properties, and the vermilion presets.
---

# Theming

The vanilla viewer uses the same `ViewerTheme` system as the React, Vue, and Angular bindings:
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
```

Every value is optional: unset colors fall back to the built-in dark defaults
(`defaultThemeColors`), and radius falls back to `defaultRadius`.

## The `ViewerTheme` shape

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

`ViewerThemeColors` covers the full chrome palette: `background`, `foreground`, `card`,
`popover`, `primary`, `secondary`, `muted`, `accent`, `destructive` (each with a
`*Foreground` pair), plus `border`, `input`, and `ring`.

## Presets and helpers

| Export                                       | What it is                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `vermilionLightTheme` / `vermilionDarkTheme` | The docs-brand light/dark presets shared by every binding.                                                                     |
| `defaultThemeColors`, `defaultRadius`        | The built-in fallback palette and radius.                                                                                      |
| `themeToCssVars(theme)`                      | Resolve a theme to its final `--pptx-*` variable map. Useful for styling chrome _around_ the viewer (see the demo's dropzone). |
| `defaultCssVars()`                           | The full default variable map.                                                                                                 |

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

## Viewer CSS

The viewer injects its stylesheet automatically (a single `<style>` tag, deduplicated across
instances). For CSP-strict hosts that disallow injected styles, ship the CSS yourself via
[`getViewerCss()`](/vanilla/getting-started#csp-strict-hosts-getviewercss).
