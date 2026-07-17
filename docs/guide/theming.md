---
title: Theming
description: The ViewerTheme system, the built-in File > Options > Appearance picker, and how runtime theme switching is resolved across React, Vue 3, Angular, Vanilla, and Svelte.
---

# Theming

The viewer chrome (toolbar, ribbon, dialogs, backstage) is themed through a `ViewerTheme` object: a set of CSS custom properties (`--pptx-*`) applied to the viewer root. This is entirely separate from a presentation's own OOXML color scheme/fonts (the Design tab's "Themes" gallery edits the `.pptx` document itself) - `ViewerTheme` only affects the app's own UI.

```ts
interface ViewerThemeColors {
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	// ...primary, secondary, muted, accent, destructive, border, input, ring
}

interface ViewerTheme {
	colors?: Partial<ViewerThemeColors>;
	radius?: string;
	/** Escape hatch: arbitrary `--custom-property` overrides. */
	cssVars?: Record<string, string>;
}
```

## File > Options > Appearance

Every binding's Settings dialog has an **Appearance** tab: a small gallery of built-in theme presets (Default, Light, Vermilion Light, Vermilion Dark) a user can click through at runtime, exported from `pptx-viewer-shared` as `THEME_CATALOG`:

```ts
interface ThemeCatalogEntry {
	key: string; // 'default' | 'light' | 'vermilionLight' | 'vermilionDark'
	labelKey: string; // pptx.* translation key for the tab label
	theme: ViewerTheme | undefined; // undefined = reset to the built-in default
}
```

This is deliberately a short, curated list, not a full gallery - pass `availableThemes` (below) if you want more or fewer choices.

## Precedence: explicit `theme` prop always wins

Nothing changes for existing consumers. If you already pass a `theme` prop/input to the viewer, it keeps winning over anything picked in the Appearance tab - the picker is inert while `theme` is set. This is intentional: a host that owns its own theme (e.g. syncing with the rest of its app's dark-mode toggle) shouldn't have that overridden by a click inside the viewer.

The Appearance tab only takes effect when you **don't** pass an explicit `theme`. In that "standalone" mode, resolution order is:

1. `defaultThemeKey` prop (if you want a non-"default" starting point)
2. A previously persisted choice (`localStorage`, key `pptx-viewer-prefs`)
3. The catalog's `'default'` entry

## New props (all optional, all backward compatible)

| Prop               | Type                     | Purpose                                                                                                                            |
| ------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `defaultThemeKey`  | `string`                 | Initial `THEME_CATALOG` key, used only when nothing is persisted yet.                                                              |
| `availableThemes`  | `ThemeCatalogEntry[]`    | Override the catalog offered in Appearance (add your own presets, or narrow the list).                                             |
| `onThemeChange`    | `(key: string) => void`  | Host hook: when supplied, **you** own persisting the choice - the viewer stops writing to `localStorage` and just calls this back. |
| `defaultLocale`    | `string`                 | Same idea for Language: initial locale code when nothing is persisted.                                                             |
| `availableLocales` | `LocaleCatalogEntry[]`   | Override the locales offered in Options > Language.                                                                                |
| `onLocaleChange`   | `(code: string) => void` | Host hook: when supplied, the viewer never touches your i18n instance itself - it only calls this back.                            |

React/Vue/Angular/Svelte all use this exact shape. **Vanilla is the one exception**: it already had public `theme`/`locale` constructor options and `setTheme()`/`setLocale()` methods before this feature existed, so it reuses those directly as the initial value instead of adding separate `defaultThemeKey`/`defaultLocale` options - `availableThemes`/`availableLocales`/`onThemeChange`/`onLocaleChange` are the same as everywhere else.

```tsx
// React - fully standalone, no host wiring
<PowerPointViewer content={bytes} />
// Options > Appearance now works out of the box, persisted per-browser.
```

```tsx
// React - host owns theme persistence (e.g. syncing with app-wide dark mode)
<PowerPointViewer
	content={bytes}
	defaultThemeKey={systemPrefersDark ? 'vermilionDark' : 'vermilionLight'}
	onThemeChange={(key) => saveUserPreference('viewerTheme', key)}
/>
```

```ts
// Vanilla - the existing theme/locale options already serve as the initial value
const viewer = createPptxViewer(host, {
	source: bytes,
	theme: myAppTheme, // still always wins, same as before
	onThemeChange: (key) => analytics.track('theme_changed', { key }),
});
```

## Adding your own presets

Pass `availableThemes` with your own `ThemeCatalogEntry[]` (import `resolveThemeCatalogEntry`/`THEME_CATALOG` from the package if you want to extend rather than replace the built-ins):

```ts
import { THEME_CATALOG } from 'pptx-react-viewer/theme';

const availableThemes = [
	...THEME_CATALOG,
	{ key: 'brand', labelKey: 'app.theme.brand', theme: { colors: { primary: '#7c3aed' } } },
];
```

`labelKey` is looked up through whatever i18n dictionary your app supplies (see [Localization](/guide/localization)) - for a custom entry, register that key yourself; unregistered keys fall back to a readable label derived from the key's last segment.

## Next steps

- [Localization (i18n)](/guide/localization) - the Language tab works the same way, and this is where the `pptx.*` translation keys backing theme labels come from.
- [Account & Sign-in](/guide/account) - File > Account's profile editor also persists to the same `localStorage` key as the theme/locale fallback.
