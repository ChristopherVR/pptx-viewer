# pptx-vue-viewer

A Vue 3 PowerPoint (`.pptx`) viewer component, built on the framework-agnostic
[`pptx-viewer-core`](../core) engine. This is the Vue counterpart of the React
[`pptx-viewer`](../react) package.

> **Status: early / viewer-first.** This package currently renders presentations
> (slides, text, basic shapes, images, groups) with slide navigation and zoom.
> Editing, charts, tables, SmartArt, connectors, presentation mode, export, and
> collaboration are being ported incrementally — see
> [`PORTING.md`](./PORTING.md) for the roadmap and per-area status.

## Installation

```bash
npm install pptx-vue-viewer vue
# peer deps used by the core engine:
npm install jszip fast-xml-parser
```

## Usage

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles';

const content = ref<Uint8Array>();
const viewer = ref<PowerPointViewerExpose>();

onMounted(async () => {
	const res = await fetch('/example.pptx');
	content.value = new Uint8Array(await res.arrayBuffer());
});

async function save() {
	const bytes = await viewer.value!.getContent();
	// …download or upload bytes…
}
</script>

<template>
	<PowerPointViewer
		v-if="content"
		ref="viewer"
		:content="content"
		:theme="{ colors: { primary: '#6366f1' } }"
		@active-slide-change="(i) => console.log('slide', i)"
		style="height: 100vh"
	/>
</template>
```

## Props

| Prop            | Type                        | Description                                       |
| --------------- | --------------------------- | ------------------------------------------------- |
| `content`       | `Uint8Array \| ArrayBuffer` | The `.pptx` file bytes. **Required.**             |
| `theme`         | `ViewerTheme`               | Color / radius overrides via `--pptx-*` CSS vars. |
| `canEdit`       | `boolean`                   | Reserved for the editor port (no-op today).       |
| `class`         | `string`                    | Class applied to the root element.                |
| `filePath`      | `string`                    | Original path (reserved for autosave).            |
| `authorName`    | `string`                    | Reserved for comments/annotations.                |
| `collaboration` | `CollaborationConfig`       | Reserved (collaboration not yet ported).          |

## Events

| Event                 | Payload      | Notes                         |
| --------------------- | ------------ | ----------------------------- |
| `active-slide-change` | `number`     | Active slide index changed.   |
| `content-change`      | `Uint8Array` | Reserved for the editor port. |
| `dirty-change`        | `boolean`    | Reserved for the editor port. |

## Exposed methods (`ref`)

| Method         | Returns               | Description                          |
| -------------- | --------------------- | ------------------------------------ |
| `getContent()` | `Promise<Uint8Array>` | Serialise the presentation to bytes. |

## Theme

Pass a `theme` prop to override the built-in dark UI. Values map to
`--pptx-*` CSS custom properties (shadcn/ui token names).

```ts
import { provideViewerTheme, themeToCssVars } from 'pptx-vue-viewer';
```

## License

MIT © ChristopherVR
