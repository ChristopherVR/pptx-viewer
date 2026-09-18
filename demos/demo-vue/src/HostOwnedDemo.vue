<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { PowerPointViewerExpose } from 'pptx-vue-viewer';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';
import type { HostOwnedShellHandle } from '../../shared/host-owned-shell-controls';
import HostOwnedHeadlessEditor from './HostOwnedHeadlessEditor.vue';

const headless = new URLSearchParams(location.search).get('headless') === '1';
const host = shallowRef<HostOwnedDemo | null>(null);
const viewer = ref<PowerPointViewerExpose>();
const customShell = ref<HostOwnedShellHandle>();
const mounted = ref(true);
const error = ref('');
let disposed = false;
onMounted(() => {
	void createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim())
		.then((session) => {
			if (disposed) {
				session.dispose();
				return;
			}
			host.value = session;
			session.attachControls(
				(value) => {
					mounted.value = value;
				},
				async () => (headless ? customShell.value?.getContent() : viewer.value?.getContent()),
				headless ? { setScale: (scale) => customShell.value?.setScale(scale) } : undefined,
			);
			return undefined;
		})
		.catch((reason: unknown) => {
			error.value = String(reason);
		});
});
onBeforeUnmount(() => {
	disposed = true;
	host.value?.dispose();
});
</script>

<template>
	<main :style="{ position: 'fixed', inset: `${headless ? 104 : 64}px 0 0` }">
		<p v-if="error" role="alert">{{ error }}</p>
		<HostOwnedHeadlessEditor v-if="host && mounted && headless" ref="customShell" :host="host" />
		<PowerPointViewer
			ref="viewer"
			v-else-if="host && mounted"
			:content="host.source"
			:file-name="host.fileName"
			:collaboration="host.config"
			:can-edit="host.editable"
		/>
	</main>
</template>
