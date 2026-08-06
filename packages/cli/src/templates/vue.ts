// See react.ts for why the picker/new-presentation pattern and the
// `/styles.css` subpath import are what they are.
// The global styles (body background, .stage, .dropzone, etc.) live in the
// component's unscoped <style> block so no separate CSS file is required.
export const VUE_APP_VUE = `<script setup lang="ts">
import { ref } from 'vue';
import { PptxHandler } from 'pptx-viewer-core';
import type { CollaborationConfig } from 'pptx-vue-viewer';
import { PowerPointViewer } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles.css';

/**
 * The presentation formats this viewer can open: OOXML and the legacy binary
 * PowerPoint format, which pptx-viewer-core converts on load. Kept as an
 * explicit check because a drop event carries no accept filtering.
 */
function isPresentation(file: File | undefined): file is File {
	const name = file?.name.toLowerCase() ?? '';
	return name.endsWith('.pptx') || name.endsWith('.ppt');
}

const content = ref<Uint8Array>();
const over = ref(false);
const collab = ref<CollaborationConfig | undefined>();

async function loadFile(file: File) {
	content.value = new Uint8Array(await file.arrayBuffer());
}

function onDrop(e: DragEvent) {
	over.value = false;
	const file = e.dataTransfer?.files?.[0];
	if (isPresentation(file)) void loadFile(file);
}

function onPick(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) void loadFile(file);
}

async function newPresentation() {
	const { handler, data } = await PptxHandler.createBlank({
		title: 'Untitled Presentation',
		initialSlideCount: 1,
	});
	content.value = await handler.save(data.slides);
}
</script>

<template>
	<div v-if="content" style="height: 100dvh">
		<PowerPointViewer
			:content="content"
			can-edit
			style="height: 100%"
			:collaboration="collab"
			@start-collaboration="collab = $event"
			@stop-collaboration="collab = undefined"
		/>
	</div>
	<div
		v-else
		class="stage"
		@dragover.prevent="over = true"
		@dragleave="over = false"
		@drop.prevent="onDrop($event as DragEvent)"
		@click="($refs.input as HTMLInputElement).click()"
	>
		<div :class="['dropzone', { over }]">
			<h1>Open a Presentation</h1>
			<p>Drag &amp; drop a .pptx or .ppt file here, or</p>
			<label class="pick-label" @click.stop>
				Choose a file
				<input ref="input" type="file" accept=".pptx,.ppt" style="display: none" @change="onPick" />
			</label>
			<span class="or-sep">or</span>
			<button class="new-btn" @click.stop="newPresentation">New Presentation</button>
		</div>
	</div>
</template>

<style>
:root { color-scheme: dark; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: var(--pptx-background, #030712); color: var(--pptx-foreground, #f3f4f6); }
#app { height: 100dvh; }
.stage { display: flex; align-items: center; justify-content: center; height: 100dvh; padding: 2rem; }
.dropzone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; max-width: 520px; width: 100%; padding: 3rem; text-align: center; border: 2px dashed var(--pptx-border, #374151); border-radius: 0.75rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.dropzone.over, .dropzone:hover { border-color: var(--pptx-primary, #6366f1); background: var(--pptx-muted, rgba(255, 255, 255, 0.04)); }
.dropzone h1 { margin: 0; font-size: 1.5rem; font-weight: 500; }
.dropzone p { margin: 0; font-size: 0.875rem; color: var(--pptx-muted-foreground, #9ca3af); }
.pick-label { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: 1px solid var(--pptx-border, #374151); background: var(--pptx-muted, #1f2937); color: var(--pptx-foreground, #f3f4f6); cursor: pointer; font-size: 0.875rem; transition: background 0.15s; }
.pick-label:hover { background: var(--pptx-accent, #374151); }
.or-sep { font-size: 0.8rem; color: var(--pptx-muted-foreground, #6b7280); }
.new-btn { padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; background: var(--pptx-primary, #6366f1); color: #fff; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: opacity 0.15s; }
.new-btn:hover { opacity: 0.9; }
</style>
`;

export const VUE_MAIN_TS = `import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { translationsEn, keyToLabel } from 'pptx-vue-viewer/i18n';
import App from './App.vue';

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: translationsEn },
	missing: (_locale, key) => keyToLabel(key),
	missingWarn: false,
	fallbackWarn: false,
});

createApp(App).use(i18n).mount('#app');
`;
