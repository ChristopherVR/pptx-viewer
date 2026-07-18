---
title: Theming
description: The cross-binding ViewerTheme system - the theme object shape, how themeToCssVars produces --pptx-* custom properties, the built-in presets, per-binding application, and the File > Options > Appearance picker.
---

# Theming

The viewer chrome (toolbar, ribbon, dialogs, backstage) is themed through a `ViewerTheme` object: a set of CSS custom properties (`--pptx-*`) applied to the viewer root. This is entirely separate from a presentation's own OOXML color scheme and fonts (the Design tab's "Themes" gallery edits the `.pptx` document itself); `ViewerTheme` only affects the app's own UI.

The theme system is framework-agnostic. The types, defaults, presets, and helpers below are implemented once (in the internal `pptx-viewer-shared` package) and re-exported identically by every published binding: `pptx-react-viewer`, `pptx-vue-viewer`, `pptx-angular-viewer`, `pptx-svelte-viewer`, and `pptx-vanilla-viewer`.

## The `ViewerTheme` shape

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

Every field is optional; unset values fall back to the built-in dark defaults. `ViewerThemeColors` has 19 semantic tokens, named after the shadcn/ui convention. Any valid CSS color string is accepted (hex, `rgb()`, `hsl()`, `oklch()`, named colors):

| Tokens                                 | Role                                     |
| -------------------------------------- | ---------------------------------------- |
| `background`, `foreground`             | Root background and default text         |
| `card`, `cardForeground`               | Card / panel surfaces                    |
| `popover`, `popoverForeground`         | Popovers and dropdowns                   |
| `primary`, `primaryForeground`         | Primary actions (buttons, active states) |
| `secondary`, `secondaryForeground`     | Subdued actions                          |
| `muted`, `mutedForeground`             | Muted surfaces and secondary text        |
| `accent`, `accentForeground`           | Hover-highlight surfaces                 |
| `destructive`, `destructiveForeground` | Danger / delete actions                  |
| `border`, `input`, `ring`              | Borders, input borders, focus ring       |

See the [React theming page](/react/theming#viewertheme-and-viewerthemecolors) for the full token-by-token table with each token's exact CSS variable name.

## How `themeToCssVars` produces `--pptx-*` variables

`themeToCssVars(theme, omitDefaults = false)` converts a `ViewerTheme` into a flat `Record<string, string>` of CSS custom properties ready to apply to the viewer root as inline style. Every binding calls it internally when you pass a theme; it is also exported for building your own tooling.

- Each `colors` key becomes `--pptx-<kebab-case-key>`: `primaryForeground: '#fff'` emits `--pptx-primary-foreground: #fff`.
- Each color is also mirrored to the matching Tailwind semantic token (`--color-primary-foreground`), so that in a Tailwind CSS v4 host the value overrides the `@theme` declaration, which cannot see variables set on a child element.
- `radius` becomes `--pptx-radius`, plus derived `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` values (`calc(r - 4px)` through `calc(r + 4px)`).
- `cssVars` entries pass through verbatim.
- With `omitDefaults: true`, values equal to the built-in defaults are skipped.

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

## Built-in themes and presets

| Export                                         | Palette                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `defaultThemeColors` + `defaultRadius`         | The built-in dark UI (Tailwind gray scale, indigo primary, `0.5rem` radius). Applied when no theme is passed. |
| `vermilionLightTheme` / `vermilionLightColors` | Warm light "paper" palette with the vermilion accent used by this documentation site.                         |
| `vermilionDarkTheme` / `vermilionDarkColors`   | Dimmed dark "presenter room" palette with the same accent.                                                    |
| `vermilionRadius`                              | `'0.375rem'`, the radius both vermilion presets use.                                                          |

Both vermilion presets are complete `ViewerTheme` objects (all 19 tokens plus radius), so they fully replace the dark defaults. The raw `*Colors` palettes are exported alongside for deriving variants:

```ts
import { vermilionDarkColors, vermilionRadius } from 'pptx-react-viewer';
import type { ViewerTheme } from 'pptx-react-viewer';

const custom: ViewerTheme = {
	colors: { ...vermilionDarkColors, primary: '#38bdf8' },
	radius: vermilionRadius,
};
```

A plain (non-vermilion) light palette also exists, but it is not a named export of the bindings; reach it through the theme catalog: `resolveThemeCatalogEntry('light')`.

## Applying a theme per binding

Every binding takes the same `ViewerTheme` object; only the delivery mechanism differs.

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

For sharing one theme across multiple viewers, React exports `ViewerThemeProvider` / `useViewerTheme`, Vue exports `provideViewerTheme` / `useViewerTheme`, and Angular exports `provideViewerTheme` / the `VIEWER_THEME` injection token.

## Styling modes

The viewer UI references `--pptx-*` custom properties for every visual token, which allows three styling setups (in increasing order of control):

| Mode                      | Setup                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tailwind CSS v4 host      | No CSS import needed; the viewer's classes resolve through your existing config. Override values with the `theme` prop/input.                                                      |
| Bundled stylesheet        | `import 'pptx-react-viewer/styles'` (same `/styles` or `/styles.css` subpath on the Vue, Angular, and Svelte packages). Ships all required utility classes plus the dark defaults. |
| Raw CSS custom properties | Define the `--pptx-*` properties yourself (see `defaultCssVars()` for the full list) and skip both.                                                                                |

The vanilla binding is the exception: `createPptxViewer` injects its own scoped stylesheet automatically (idempotent, `#pptx-vanilla-viewer-styles`). Hosts with a strict CSP can pre-render the string from `getViewerCss()` instead.

## File > Options > Appearance

Every binding's Settings dialog has an **Appearance** tab: a small gallery of built-in theme presets (Default, Light, Vermilion Light, Vermilion Dark) a user can click through at runtime, defined by the `THEME_CATALOG` export:

```ts
interface ThemeCatalogEntry {
	key: string; // 'default' | 'light' | 'vermilionLight' | 'vermilionDark'
	labelKey: string; // pptx.* translation key for the entry's label
	theme: ViewerTheme | undefined; // undefined = reset to the built-in default
}
```

This is deliberately a short, curated list, not a full gallery; pass `availableThemes` (below) for more or fewer choices. `resolveThemeCatalogEntry(key, catalog?)` looks an entry up by key.

### Precedence: an explicit `theme` always wins

If you pass a `theme` prop/input to the viewer, it keeps winning over anything picked in the Appearance tab; the picker is inert while `theme` is set. This is intentional: a host that owns its own theme (for example, syncing with an app-wide dark-mode toggle) should not have it overridden by a click inside the viewer.

The Appearance tab only takes effect when you do **not** pass an explicit `theme`. In that standalone mode, resolution order is:

1. `defaultThemeKey` prop (for a non-`'default'` starting point)
2. A previously persisted choice (`localStorage`, key `pptx-viewer-prefs`)
3. The catalog's `'default'` entry

### Catalog props (all optional)

| Prop               | Type                     | Purpose                                                                                                                |
| ------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `defaultThemeKey`  | `string`                 | Initial `THEME_CATALOG` key, used only when nothing is persisted yet.                                                  |
| `availableThemes`  | `ThemeCatalogEntry[]`    | Override the catalog offered in Appearance (add your own presets, or narrow the list).                                 |
| `onThemeChange`    | `(key: string) => void`  | When supplied, **you** own persisting the choice; the viewer stops writing to `localStorage` and only calls this back. |
| `defaultLocale`    | `string`                 | Same idea for Language: initial locale code when nothing is persisted.                                                 |
| `availableLocales` | `LocaleCatalogEntry[]`   | Override the locales offered in Options > Language.                                                                    |
| `onLocaleChange`   | `(code: string) => void` | When supplied, the viewer never touches your i18n instance itself; it only calls this back.                            |

React, Vue, Angular, and Svelte all use this exact shape. Vanilla is the one exception: it already had public `theme`/`locale` constructor options and `setTheme()`/`setLocale()` methods, so those serve as the initial value instead of separate `defaultThemeKey`/`defaultLocale` options; `availableThemes`/`availableLocales`/`onThemeChange`/`onLocaleChange` are the same as everywhere else.

```tsx
// React - host owns theme persistence (e.g. syncing with app-wide dark mode)
<PowerPointViewer
	content={bytes}
	defaultThemeKey={systemPrefersDark ? 'vermilionDark' : 'vermilionLight'}
	onThemeChange={(key) => saveUserPreference('viewerTheme', key)}
/>
```

### Adding your own presets

Pass `availableThemes` with your own `ThemeCatalogEntry[]`; extend the built-ins rather than replacing them by spreading `THEME_CATALOG`:

```ts
import { THEME_CATALOG } from 'pptx-react-viewer';

const availableThemes = [
	...THEME_CATALOG,
	{ key: 'brand', labelKey: 'app.theme.brand', theme: { colors: { primary: '#7c3aed' } } },
];
```

`labelKey` is looked up through whatever i18n dictionary your app supplies (see [Localization](/guide/localization)); for a custom entry, register that key yourself. Unregistered keys fall back to a readable label derived from the key's last segment.

## Per-binding details

- [React theming](/react/theming) - the `theme` prop, `ViewerThemeProvider`, and the full token table
- [Vue theming](/vue/theming) - the `theme` prop and `provideViewerTheme`
- [Angular theming](/angular/theming) - the `theme` input, `provideViewerTheme`, and the `VIEWER_THEME` token
- [Svelte theming](/svelte/theming) - the `theme` prop
- [Vanilla theming](/vanilla/theming) - the `theme` option, `setTheme()`, and `getViewerCss()`

## Next steps

- [Localization (i18n)](/guide/localization) - the Language tab works the same way, and this is where the `pptx.*` translation keys backing theme labels come from.
- [Account & Sign-in](/guide/account) - File > Account's profile editor also persists to the same `localStorage` key as the theme/locale fallback.
