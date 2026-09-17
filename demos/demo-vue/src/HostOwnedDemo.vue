<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { PowerPointViewerExpose } from 'pptx-vue-viewer';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';

const host = shallowRef<HostOwnedDemo | null>(null);
const viewer = ref<PowerPointViewerExpose>();
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
				async () => viewer.value?.getContent(),
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
	<main style="position: fixed; inset: 64px 0 0">
		<p v-if="error" role="alert">{{ error }}</p>
		<PowerPointViewer
			ref="viewer"
			v-if="host && mounted"
			:content="host.source"
			:file-name="host.fileName"
			:collaboration="host.config"
			:can-edit="host.editable"
		/>
	</main>
</template>
