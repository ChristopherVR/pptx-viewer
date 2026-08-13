---
title: Svelte Viewer Getting Started
description: Install and mount the Svelte 5 PowerPoint viewer component, load .pptx bytes from a URL or file input, navigate slides, enter presentation mode, and enable editing.
---

# Getting Started

This page walks from an empty component to a working viewer with file loading, navigation,
presentation mode, and editing.

## Install

```bash
npm i pptx-svelte-viewer
```

`svelte` ^5 is a peer dependency. The engine's runtime dependencies (`jszip`,
`fast-xml-parser`) install automatically with the package.

Then import the extracted stylesheet once, in your app entry or root component:

```ts
import 'pptx-svelte-viewer/styles.css';
```

::: warning The CSS import is required
Component styles are compiled out to a real stylesheet at build time (`css: 'external'`), the
same way the React and Vue packages ship their CSS. Nothing is injected at runtime, so without
this import the viewer renders unstyled.
:::

## 1. Mount the component

`source` takes the raw `.pptx` bytes as a `Uint8Array` or `ArrayBuffer` (the Svelte equivalent
of the Vue binding's `content` prop). The viewer fills its container, so give the wrapper an
explicit height:

```svelte
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);

	fetch('/decks/quarterly.pptx')
		.then((res) => res.arrayBuffer())
		.then((buf) => (bytes = new Uint8Array(buf)));
</script>

{#if bytes}
	<div style="height: 100dvh">
		<PowerPointViewer
			source={bytes}
			initialSlide={0}
			onload={({ slideCount, canvasSize }) => console.log(slideCount, canvasSize)}
			onerror={(message) => console.error(message)}
			onslidechange={(index) => console.log('slide', index)}
		/>
	</div>
{/if}
```

`onload` fires once per successful load with the slide count and the slide canvas size in
pixels; `onerror` receives a human-readable message when a load fails.

## 2. Loading a presentation

There is no URL prop; you fetch or read bytes yourself and assign them to `source`. Assigning a
new value loads the new presentation in place.

::: code-group

```svelte [From a URL]
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);

	async function load(url: string) {
		const res = await fetch(url);
		bytes = new Uint8Array(await res.arrayBuffer());
	}

	load('/decks/quarterly.pptx');
</script>

{#if bytes}
	<PowerPointViewer source={bytes} />
{/if}
```

```svelte [From a file input]
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);

	async function onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) bytes = new Uint8Array(await file.arrayBuffer());
	}
</script>

<input type="file" accept=".pptx,.ppt" onchange={onPick} />
{#if bytes}
	<PowerPointViewer source={bytes} />
{/if}
```

```svelte [From existing bytes]
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	// e.g. bytes from an API response, IndexedDB, or a previous save()
	let { deck }: { deck: Uint8Array } = $props();
</script>

<PowerPointViewer source={deck} />
```

:::

## 3. Navigation and zoom

The built-in toolbar covers navigation, zoom, notes, fullscreen, and (when `editable`) the
full ribbon. Everything it does is also reachable programmatically through the component
instance (`bind:this`):

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
</script>

<PowerPointViewer source={bytes} bind:this={viewer} />

<button onclick={() => viewer?.goPrev()}>Prev</button>
<button onclick={() => viewer?.goNext()}>Next</button>
<button onclick={() => viewer?.goTo(3)}>Slide 4</button>
<button onclick={() => viewer?.zoomIn()}>Zoom in</button>
```

See [Instance API](/svelte/api) for the complete method reference, and `showToolbar` /
`showThumbnails` / `hiddenActions` in [Component Props](/svelte/props) if you want to hide the
built-in chrome and drive everything yourself.

## 4. Presentation mode

The toolbar's presentation button (and the Slide Show ribbon tab) enters fullscreen
presentation mode via the real **Fullscreen API**; Esc exits. Slide transitions and animations
play back, and a presenter view can open the audience display in a separate window.

Programmatically, presentation mode is a viewer _mode_:

```ts
viewer?.setMode('present'); // enter fullscreen presentation
viewer?.setMode('preview'); // leave it (back to read-only viewing)
viewer?.getMode(); // 'preview' | 'edit' | 'present' | 'master'
```

Track it with the `onmodechange` callback.

::: tip Keyboard support
With focus on the viewer: arrow keys, PageUp/PageDown, and Space move between slides; Home/End
jump to the first/last slide; Esc exits presentation mode.
:::

## 5. Editing {#editing}

Pass `editable` to turn the viewer into an editor: click to select, drag to move, 8 resize
handles (Shift locks aspect), a rotate handle, double-click to edit text, and keyboard
shortcuts for delete/duplicate/nudge/undo/redo. The toolbar gains Undo/Redo/Save/Download and
the full ribbon.

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
	let dirty = $state(false);
</script>

<PowerPointViewer
	source={bytes}
	editable
	bind:this={viewer}
	ondirtychange={(d) => (dirty = d)}
	onchange={() => console.log('edited')}
/>

<button disabled={!dirty} onclick={() => viewer?.downloadPptx('edited.pptx')}>
	Download
</button>
```

`save()` returns the serialized `.pptx` bytes if you want to persist them yourself; see
[Instance API > Editing](/svelte/api#editing).

## 6. Autosave and crash recovery {#autosave}

With `autosave` and a `filePath` (the IndexedDB record key, typically the file name), every
committed edit is debounced (default 2000 ms) and serialized to `.pptx` bytes in a shared
IndexedDB recovery store; `onautosave` fires with the bytes after each successful snapshot.

```svelte
<PowerPointViewer
	source={bytes}
	editable
	autosave
	filePath="quarterly.pptx"
	onautosave={(snapshot) => console.log('autosaved', snapshot.byteLength)}
/>
```

The viewer never restores automatically; recovery is a host concern. The store helpers are
re-exported from the package root:

```ts
import {
	getAutosaveSnapshot,
	listAutosaveSnapshots,
	deleteAutosaveSnapshot,
} from 'pptx-svelte-viewer';

const snapshot = await getAutosaveSnapshot('quarterly.pptx');
if (snapshot) {
	bytes = snapshot.data; // offer "Restore unsaved changes?" and reload
}
```

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

See [Localization](/svelte/i18n) for the fallback chain, the File > Options > Language picker
(`defaultLocale` / `availableLocales` / `onLocaleChange`), and the full helper reference.

## Next steps

- [Component Props](/svelte/props): the complete props and event-callback contract.
- [Instance API](/svelte/api): every method on the component instance.
- [Theming](/svelte/theming): the shared `ViewerTheme` system.
- [Export & Print](/svelte/export): PNG, PDF, GIF, video, SVG, print, save-as.
