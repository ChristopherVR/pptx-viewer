---
title: Svelte Viewer Overview
description: pptx-svelte-viewer is a Svelte 5 PowerPoint viewer component built on the same engine as the React, Vue, and Angular bindings - render, edit, present, and export .pptx slides with a single component.
---

# Svelte Viewer Overview

`pptx-svelte-viewer` is a **Svelte 5** viewer/editor component for `.pptx` files. Its
`<PowerPointViewer>` component renders `.pptx` slides with the same shared render logic and
theme system as the React, Vue, Angular, and Vanilla JS bindings. The parsing engine
([`pptx-viewer-core`](/core/)) and the shared render layer are bundled into the package.

A live [Svelte demo](https://christophervr.github.io/pptx-viewer/demo-svelte/) is available.

## What it provides

| Capability          | Summary                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Slide rendering** | Text, shapes, images, groups, connectors, tables, charts, SmartArt (2D and opt-in 3D), media, ink, OLE, and the rest of the element model. |
| **Editing**         | Behind `editable`: insert, format, group, arrange, drag/resize/rotate, rich text/notes, master view, undo/redo, and save/download.         |
| **Navigation**      | Responsive desktop/mobile chrome, thumbnail rail, keyboard navigation, and a speaker-notes panel.                                          |
| **Presentation**    | Fullscreen presentation mode via the real Fullscreen API, with transition/animation playback and a presenter view (audience window).       |
| **Export**          | PNG, PDF, GIF, WebM video, SVG, print (slides / handouts / notes / outline), and `.pptx` / `.ppsx` / `.pptm` save-as.                      |
| **Collaboration**   | Optional real-time co-editing over Yjs (y-websocket or serverless y-webrtc), with presence, remote cursors, and Share/Broadcast dialogs.   |
| **Autosave**        | Opt-in debounced crash-recovery snapshots in IndexedDB, plus re-exported helpers for host-driven restore.                                  |
| **Theming**         | The shared `ViewerTheme` system (`--pptx-*` CSS custom properties), including the vermilion presets. See [Theming](/svelte/theming).       |
| **i18n**            | English built in; register more locales via `pptx-svelte-viewer/i18n`. See [Localization](/svelte/i18n).                                   |

::: info Element coverage
For a precise list of what the underlying parser supports, and what is approximated, see
[Limitations](/guide/limitations).
:::

## Installation

```bash
npm i pptx-svelte-viewer
```

Requires `svelte` ^5 as a peer. The core engine (`pptx-viewer-core`) and shared render layer
are **bundled in**, and the engine's runtime dependencies (`jszip`, `fast-xml-parser`) install
automatically with the package.

Two features have optional dependencies, installed only when you use them:

```bash
npm i three                    # opt-in 3D SmartArt renderer (smartArt3D prop)
npm i yjs y-websocket          # collaboration, server-based transport
npm i yjs y-webrtc             # collaboration, serverless peer-to-peer transport
```

::: warning Import the stylesheet
Unlike the vanilla binding, the Svelte package does not inject styles at runtime. Import the
extracted stylesheet once in your app entry:

```ts
import 'pptx-svelte-viewer/styles.css';
```

:::

::: info ESM only
The package ships an ESM build only: Svelte 5's client runtime is ESM-only, so a CJS artifact
could never be `require()`d successfully anyway.
:::

## Quick example

```svelte
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
	import 'pptx-svelte-viewer/styles.css';

	let bytes = $state<Uint8Array | null>(null);

	async function onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) bytes = new Uint8Array(await file.arrayBuffer());
	}
</script>

<input type="file" accept=".pptx" onchange={onPick} />
{#if bytes}
	<PowerPointViewer source={bytes} onload={({ slideCount }) => console.log(slideCount)} />
{/if}
```

## Key exports

| Export                                                       | Kind      | Purpose                                                                                       |
| ------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| `PowerPointViewer`                                           | component | The viewer/editor component. See [Getting Started](/svelte/getting-started).                  |
| `PowerPointViewerProps`, `ViewerLoadDetail`                  | type      | Props and callback payloads. See [Component Props](/svelte/props).                            |
| `PowerPointViewerApi`                                        | type      | The imperative surface reachable via `bind:this`. See [Instance API](/svelte/api).            |
| `ViewerTheme`, `ViewerThemeColors`                           | type      | Theme configuration types. See [Theming](/svelte/theming).                                    |
| `vermilionLightTheme`, `vermilionDarkTheme`                  | const     | Built-in vermilion light/dark presets.                                                        |
| `themeToCssVars`, `defaultCssVars`                           | function  | Convert a theme to `--pptx-*` CSS vars.                                                       |
| `registerTranslations`                                       | function  | Register locale dictionaries. See [Localization](/svelte/i18n).                               |
| `exportSlideToSvg`, `exportAllSlidesToSvg`, ...              | function  | Standalone SVG export helpers. See [Export & Print](/svelte/export#svg-standalone-functions). |
| `CollaborationConfig`, `CollaborationRole`                   | type      | Real-time co-editing configuration. See [Collaboration](/svelte/collaboration).               |
| `getAutosaveSnapshot`, `listAutosaveSnapshots`, ...          | function  | IndexedDB recovery-store helpers for host-driven restore.                                     |
| `ExportPdfOptions`, `ExportGifOptions`, `ExportVideoOptions` | type      | Options for the imperative export methods. See [Export & Print](/svelte/export).              |

## Rendering philosophy: CSS, not Canvas

Like every binding in this monorepo, slides render as **CSS-positioned HTML/SVG** scaled with a
CSS transform, not onto a Canvas. Text stays selectable and crisp at any zoom, and screen
readers keep working. The tradeoffs are listed in [Limitations](/guide/limitations).

## Next steps

- [Getting Started](/svelte/getting-started): mount, load, present, edit.
- [Component Props](/svelte/props): the full props and event-callback contract.
- [Instance API](/svelte/api): every method on the component instance.
- [Theming](/svelte/theming): colours, radius, CSS vars, vermilion presets.
- [Export & Print](/svelte/export): PNG, PDF, GIF, video, SVG, print, save-as.
- [Collaboration](/svelte/collaboration): real-time co-editing over Yjs.
- [Localization](/svelte/i18n): registering locale dictionaries.
