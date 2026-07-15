---
title: Svelte Viewer Getting Started
description: Install and mount the Svelte 5 PowerPoint viewer component, load .pptx bytes, theme it, and register locales.
---

# Getting Started

## Install

```bash
npm i pptx-svelte-viewer jszip fast-xml-parser
```

`svelte` ^5 is a peer dependency. `jszip` and `fast-xml-parser` are the engine's runtime peers.

## 1. Mount the component

`source` takes the raw `.pptx` bytes as a `Uint8Array` or `ArrayBuffer` (matching the Vue
binding's `content` prop):

```svelte
<script lang="ts">
	import { PowerPointViewer, vermilionDarkTheme } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);

	fetch('/decks/quarterly.pptx')
		.then((res) => res.arrayBuffer())
		.then((buf) => (bytes = new Uint8Array(buf)));
</script>

{#if bytes}
	<div style="height: 100dvh">
		<PowerPointViewer
			source={bytes}
			theme={vermilionDarkTheme}
			initialSlide={0}
			onload={({ slideCount, canvasSize }) => console.log(slideCount, canvasSize)}
			onerror={(message) => console.error(message)}
			onslidechange={(index) => console.log('slide', index)}
		/>
	</div>
{/if}
```

The viewer fills its container; give the wrapper an explicit height.

## 2. Loading from a file input

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
	<PowerPointViewer source={bytes} />
{/if}
```

Assigning a new value to `source` loads the new presentation in place.

## 3. Theming

The `theme` prop takes the shared `ViewerTheme` shape (partial palette, radius, raw CSS vars);
the `vermilionLightTheme`/`vermilionDarkTheme` presets and the `themeToCssVars` helper are
re-exported. The system is identical across bindings; see the
[Vanilla theming page](/vanilla/theming) for the full reference.

## Localization {#localization}

English ships built in. Register more locales (or override individual strings) through the
`pptx-svelte-viewer/i18n` entry point, then set the `locale` prop:

```ts
import { registerTranslations } from 'pptx-svelte-viewer/i18n';

registerTranslations('fr', {
	'pptx.statusBar.slideOf': 'Diapositive {{current}} sur {{total}}',
	// ...any subset; unset keys fall back to English
});
```

```svelte
<PowerPointViewer source={bytes} locale="fr" />
```

Dictionaries are typed as `Partial<Record<TranslationKey, string>>`, so key typos fail the
type check. The [Svelte demo](https://christophervr.github.io/pptx-viewer/demo-svelte/) uses
complete French, Spanish, and German reference dictionaries from this repository's private
`pptx-viewer-locales` workspace. Applications provide their own dictionaries through the
same `registerTranslations` API.

## Next steps

- [Component Props](/svelte/props): the complete props/events contract
- [Overview](/svelte/): scope and element coverage
