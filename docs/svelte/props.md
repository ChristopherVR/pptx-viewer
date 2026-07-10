---
title: Svelte Viewer Component Props
description: The complete props and event-callback contract of the PowerPointViewer Svelte 5 component.
---

# Component Props

`<PowerPointViewer>` follows the Vue binding's contract with two Svelte 5 conventions:
events are **callback props** (`onload`, not `@load`), and the content prop is named
**`source`**.

## Props

| Prop             | Type                                | Default       | Description                                                                                                                  |
| ---------------- | ----------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `source`         | `Uint8Array \| ArrayBuffer \| null` | -             | Raw `.pptx` bytes. Assigning a new value loads the new presentation in place.                                                |
| `theme`          | `ViewerTheme`                       | built-in dark | Partial palette / radius / raw CSS vars; see [Theming](/vanilla/theming).                                                    |
| `locale`         | `string`                            | `'en'`        | UI locale (BCP 47). Register non-English dictionaries via [`pptx-svelte-viewer/i18n`](/svelte/getting-started#localization). |
| `initialSlide`   | `number`                            | `0`           | Slide shown after load (0-based, clamped).                                                                                   |
| `showThumbnails` | `boolean`                           | `true`        | Show the thumbnail sidebar.                                                                                                  |
| `showToolbar`    | `boolean`                           | `true`        | Show the navigation/zoom toolbar.                                                                                            |
| `class`          | `string`                            | `''`          | Extra class on the root element.                                                                                             |

## Event callbacks

| Prop            | Signature                                                          | Fired when                                |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| `onload`        | `(detail: { slideCount: number; canvasSize: CanvasSize }) => void` | A presentation finishes loading.          |
| `onerror`       | `(message: string) => void`                                        | A load fails (message is human-readable). |
| `onslidechange` | `(index: number) => void`                                          | The active slide changes (0-based).       |

## Type exports

```ts
import type {
	CanvasSize,
	PowerPointViewerProps,
	ViewerLoadDetail,
	ViewerTheme,
	ViewerThemeColors,
} from 'pptx-svelte-viewer';
```

Theme presets and helpers (`vermilionLightTheme`, `vermilionDarkTheme`, `defaultThemeColors`,
`defaultRadius`, `themeToCssVars`, `defaultCssVars`) are re-exported from the package root;
i18n helpers (`registerTranslations`, `translate`, `keyToLabel`, `translationsEn`, and the
`TranslationKey` type) live under `pptx-svelte-viewer/i18n`.
