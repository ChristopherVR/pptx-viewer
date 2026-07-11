// See react.ts for why the picker/new-presentation pattern and the
// `/styles.css` subpath import are what they are.
export const VUE_APP_VUE = `<script setup lang="ts">
import { ref } from 'vue';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewer } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles.css';

const content = ref<Uint8Array>();

function loadFile(file: File) {
	const reader = new FileReader();
	reader.onload = () => (content.value = new Uint8Array(reader.result as ArrayBuffer));
	reader.readAsArrayBuffer(file);
}

function onPick(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) loadFile(file);
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
	<div v-if="content" style="height: 100vh">
		<PowerPointViewer :content="content" can-edit style="height: 100%" />
	</div>
	<div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; height: 100vh; font-family: system-ui, sans-serif">
		<h1 style="margin: 0; font-size: 24px; font-weight: 500; color: #e5e7eb">Open a Presentation</h1>
		<label style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1px solid #4b5563; background: #1f2937; color: #f3f4f6; cursor: pointer; font-size: 14px">
			Choose .pptx file
			<input type="file" accept=".pptx" style="display: none" @change="onPick" />
		</label>
		<span style="color: #6b7280; font-size: 13px">or</span>
		<button style="padding: 10px 20px; border-radius: 8px; border: none; background: #2563eb; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500" @click="newPresentation">New Presentation</button>
	</div>
</template>
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
