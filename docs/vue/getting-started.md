---
title: Getting Started
description: Load a .pptx ArrayBuffer into PowerPointViewer, render it read-only, then enable editing with the dirty-change/content-change events.
---

# Getting Started

This page walks from a read-only viewer to an editable one, wiring a file `<input>` and the
`@dirty-change` / `@content-change` events.

::: tip Prerequisites
Install the package and its peer deps first, see [Overview > Installation](/vue/#installation).
:::

## 1. Read-only viewer

The component takes its slide data through the `content` prop as a **`Uint8Array` (or
`ArrayBuffer`)** of raw `.pptx` bytes. The component fills its parent, so give the parent an
explicit height.

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import { ref, onMounted } from 'vue';

// If your app does NOT use Tailwind CSS v4, import the bundled stylesheet once
// at your entry point (see Theming for the three styling modes):
import 'pptx-vue-viewer/styles';

const content = ref<Uint8Array | null>(null);

onMounted(async () => {
	const buf = await fetch('/presentation.pptx').then((r) => r.arrayBuffer());
	content.value = new Uint8Array(buf);
});
</script>

<template>
	<div style="height: 100vh">
		<div v-if="!content">Loading...</div>
		<PowerPointViewer v-else :content="content" />
	</div>
</template>
```

::: tip `content` accepts `Uint8Array` or `ArrayBuffer`
Unlike the React binding, the Vue prop type is `Uint8Array | ArrayBuffer`, so a raw `fetch(...)
.arrayBuffer()` result can be passed straight through without wrapping.
:::

## 2. Loading from a file `<input>`

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import { ref } from 'vue';

const content = ref<Uint8Array | null>(null);

async function handleFile(e: Event): Promise<void> {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (!file) return;
	content.value = new Uint8Array(await file.arrayBuffer());
}
</script>

<template>
	<div style="display: flex; flex-direction: column; height: 100vh">
		<input type="file" accept=".pptx,.ppt" @change="handleFile" />
		<div style="flex: 1; min-height: 0">
			<PowerPointViewer v-if="content" :content="content" />
		</div>
	</div>
</template>
```

## 3. Enabling editing

Set `can-edit` to turn on the editing toolbar and inspector. Track changes with the events:

- `@dirty-change="isDirty => ..."` - fires when the unsaved-changes flag flips.
- `@content-change="bytes => ..."` - fires with the **re-serialized `Uint8Array`** when the document changes.
- `@active-slide-change="index => ..."` - fires when the active slide changes.

```vue
<script setup lang="ts">
import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer';
import { ref } from 'vue';

const props = defineProps<{ initial: Uint8Array }>();
const viewer = ref<PowerPointViewerExpose>();
const dirty = ref(false);

async function save(): Promise<void> {
	const bytes = await viewer.value?.getContent(); // Uint8Array
	if (bytes) {
		// POST to your server, write to disk, trigger a download, ...
	}
}
</script>

<template>
	<div style="height: 100vh">
		<button :disabled="!dirty" @click="save">Save{{ dirty ? ' *' : '' }}</button>
		<PowerPointViewer
			ref="viewer"
			:content="props.initial"
			can-edit
			@dirty-change="dirty = $event"
			@content-change="(bytes) => {}"
			@active-slide-change="(i) => console.log('slide', i)"
		/>
	</div>
</template>
```

::: info Saving
The most reliable way to retrieve the current document is the exposed
[`getContent()`](/vue/handle), which serializes on demand. `@content-change` also delivers the
latest bytes as edits happen.
:::

## SSR notes

`PowerPointViewer` is a client-only component: it reaches for the DOM, `window`, and browser APIs
(file/canvas/clipboard) during setup. In an SSR framework (Nuxt, Vite SSR, etc.), render it only on
the client:

```vue
<template>
	<ClientOnly>
		<PowerPointViewer :content="content" />
	</ClientOnly>
</template>
```

Nuxt ships `<ClientOnly>` globally; in a framework without an equivalent, gate rendering on a
`mounted`/`onMounted` flag instead. The package does not ship its own SSR guard, so the boundary must
be declared on the consuming side.

## Styling / required CSS

There is **no mandatory CSS import** if your app already uses Tailwind CSS v4 with the shadcn-style
semantic tokens, the viewer's classes resolve through your existing config. Otherwise, import the
bundled stylesheet once at your entry point:

```ts
import 'pptx-vue-viewer/styles'; // or 'pptx-vue-viewer/styles.css'
```

See [Theming](/vue/theming) for the three styling modes and how to customise colours.

## Next steps

- [Component Props](/vue/props) - every prop and event in detail.
- [Imperative Handle](/vue/handle) - the `defineExpose` API.
- [Export](/vue/export) - turning slides into PNG/PDF/etc.
