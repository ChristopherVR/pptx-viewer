---
title: Svelte Viewer Overview
description: pptx-svelte-viewer is a Svelte 5 PowerPoint viewer component - render .pptx slides in the browser with a single component.
---

# Svelte Viewer Overview

`pptx-svelte-viewer` brings the pptx-viewer engine to **Svelte 5**: a single
`<PowerPointViewer>` component (built with runes) renders `.pptx` slides with the same shared
render logic and theme system as the React, Vue, and Angular bindings. The parsing engine
([`pptx-viewer-core`](/core/)) and the shared render layer are bundled in.

::: warning Viewer-only scope
Like the [Vanilla JS binding](/vanilla/), this package is currently a **viewer**: it loads,
renders, navigates, and presents. There is no WYSIWYG editing, export, collaboration, or
animation playback yet, and the `table`, `chart`, `smartArt`, `media`, `ink`, and `ole`
element types render as typed placeholders for now (the Vanilla binding already renders them;
the Svelte port is tracked in the repository's
[PORTING.md](https://github.com/ChristopherVR/pptx-viewer/blob/main/PORTING.md)).
:::

Try it live: the [Svelte demo](https://christophervr.github.io/pptx-viewer/demo-svelte/).

## What it provides

| Capability          | Summary                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Slide rendering** | Text, shapes, images, groups, and connectors render with full shared-style fidelity today.                                          |
| **Navigation**      | Toolbar, thumbnail rail, keyboard navigation.                                                                                       |
| **Presentation**    | Fullscreen presentation mode via the real Fullscreen API.                                                                           |
| **Theming**         | The shared `ViewerTheme` system (`--pptx-*` CSS custom properties), including the vermilion presets.                                |
| **i18n**            | English built in; register more locales via `pptx-svelte-viewer/i18n`. See [Getting Started](/svelte/getting-started#localization). |

## Installation

```bash
npm i pptx-svelte-viewer jszip fast-xml-parser
```

Requires `svelte` ^5 as a peer. The core engine and shared render layer are bundled in.

## Quick example

```svelte
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

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

## Next steps

- [Getting Started](/svelte/getting-started): mounting, loading, theming, localization
- [Component Props](/svelte/props): the full props/events contract
- [Theming](/vanilla/theming): the shared `ViewerTheme` system (identical across bindings)
