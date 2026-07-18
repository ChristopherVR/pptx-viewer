---
title: Svelte Viewer Theming
description: Theme the Svelte PowerPoint viewer with the shared ViewerTheme system - palette overrides, border radius, raw CSS custom properties, the vermilion presets, and the built-in theme picker.
---

# Theming

The Svelte viewer uses the same `ViewerTheme` system as the React, Vue, Angular, and Vanilla
bindings: a palette of named colors, an optional border radius, and optional raw CSS custom
properties, all applied as `--pptx-*` variables on the viewer root.

## Passing a theme

```svelte
<script lang="ts">
	import { PowerPointViewer, vermilionDarkTheme } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
</script>

<PowerPointViewer source={bytes} theme={vermilionDarkTheme} />
```

The prop is reactive: assigning a new theme object restyles the chrome in place.

```svelte
<PowerPointViewer
	source={bytes}
	theme={{ colors: { background: '#0c1222', foreground: '#e2e8f0', primary: '#38bdf8' } }}
/>
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

All exported from the package root:

| Export                                         | What it is                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `vermilionLightTheme` / `vermilionDarkTheme`   | The docs-brand light/dark presets shared by every binding.                                         |
| `vermilionLightColors` / `vermilionDarkColors` | Just the palettes of those presets.                                                                |
| `vermilionRadius`                              | The presets' border radius.                                                                        |
| `defaultThemeColors`, `defaultRadius`          | The built-in fallback palette and radius.                                                          |
| `themeToCssVars(theme)`                        | Resolve a theme to its final `--pptx-*` variable map. Useful for styling chrome around the viewer. |
| `defaultCssVars()`                             | The full default variable map.                                                                     |

## The built-in theme picker {#theme-picker}

The viewer ships a user-facing theme picker (Design tab and File > Options > Appearance),
driven by three props:

| Prop              | Type                           | Description                                                                                                                               |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultThemeKey` | `string`                       | Initial selection: a key into `availableThemes`. Falls back to the `localStorage`-persisted choice, then `'default'`.                     |
| `availableThemes` | `readonly ThemeCatalogEntry[]` | The choices offered. Defaults to the built-in catalog: `default`, `light`, `vermilionLight`, `vermilionDark`.                             |
| `onThemeChange`   | `(themeKey: string) => void`   | Fired with the selected key. Supplying it hands persistence to the host; without it the choice is stored in `localStorage` automatically. |

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

::: tip Precedence between `theme` and the picker
Once the user picks a catalog entry, that key drives the effective theme for the rest of the
session. The `theme` prop still applies whenever the resolved key is `'default'` (whose entry
maps to `undefined`), so a host-supplied theme remains the out-of-the-box appearance.
:::

## Styling host chrome to match

`themeToCssVars` lets surrounding UI track the active theme:

```ts
import { themeToCssVars, vermilionDarkTheme } from 'pptx-svelte-viewer';

for (const [key, value] of Object.entries(themeToCssVars(vermilionDarkTheme))) {
	document.documentElement.style.setProperty(key, value);
}
```

Your own elements can then use `var(--pptx-background)`, `var(--pptx-primary)`, and friends,
exactly as the [Svelte demo](https://christophervr.github.io/pptx-viewer/demo-svelte/) does for
its landing screen.

## Viewer CSS

The component's structural styles are a build-time stylesheet, not runtime injection; import it
once (see [Getting Started](/svelte/getting-started#install)):

```ts
import 'pptx-svelte-viewer/styles.css';
```

All chrome colours in that stylesheet resolve through the `--pptx-*` custom properties this
page describes, so a theme never requires overriding CSS rules directly.
