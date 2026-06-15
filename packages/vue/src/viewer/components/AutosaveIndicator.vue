<script setup lang="ts">
/**
 * AutosaveIndicator — a tiny status pill for the editor toolbar.
 *
 * Reflects the autosave lifecycle (`status`) and the unsaved-edits flag
 * (`isDirty`) as a short label: "Saving…", "Saved", "Save failed", or
 * "Unsaved changes". Purely presentational; the logic lives in
 * `useAutosave`.
 */
import { computed } from 'vue';

import type { AutosaveStatus } from '../composables/useAutosave';

const props = defineProps<{
	status: AutosaveStatus;
	isDirty: boolean;
}>();

type Tone = 'idle' | 'saving' | 'saved' | 'error' | 'dirty';

const tone = computed<Tone>(() => {
	if (props.status === 'saving') {
		return 'saving';
	}
	if (props.status === 'error') {
		return 'error';
	}
	if (props.isDirty) {
		return 'dirty';
	}
	if (props.status === 'saved') {
		return 'saved';
	}
	return 'idle';
});

const label = computed(() => {
	switch (tone.value) {
		case 'saving':
			return 'Saving…';
		case 'error':
			return 'Save failed';
		case 'dirty':
			return 'Unsaved changes';
		case 'saved':
			return 'Saved';
		default:
			return 'All changes saved';
	}
});
</script>

<template>
	<span
		class="pptx-vue-autosave"
		:class="`pptx-vue-autosave--${tone}`"
		role="status"
		aria-live="polite"
	>
		<span v-if="tone === 'saving'" class="pptx-vue-autosave__spinner" aria-hidden="true" />
		<span v-else class="pptx-vue-autosave__dot" aria-hidden="true" />
		{{ label }}
	</span>
</template>

<style scoped>
.pptx-vue-autosave {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.15em 0.6em;
	font-size: 0.75rem;
	line-height: 1.4;
	border-radius: 999px;
	white-space: nowrap;
	user-select: none;
	background: var(--pptx-vue-autosave-bg, rgba(127, 127, 127, 0.14));
	color: var(--pptx-vue-autosave-fg, currentColor);
}

.pptx-vue-autosave__dot {
	width: 0.5em;
	height: 0.5em;
	border-radius: 50%;
	background: currentColor;
	opacity: 0.7;
}

.pptx-vue-autosave--saved {
	color: var(--pptx-vue-autosave-saved, #2f9e44);
}

.pptx-vue-autosave--dirty {
	color: var(--pptx-vue-autosave-dirty, #e8920c);
}

.pptx-vue-autosave--error {
	color: var(--pptx-vue-autosave-error, #e03131);
}

.pptx-vue-autosave__spinner {
	width: 0.7em;
	height: 0.7em;
	border-radius: 50%;
	border: 2px solid currentColor;
	border-top-color: transparent;
	opacity: 0.85;
	animation: pptx-vue-autosave-spin 0.7s linear infinite;
}

@keyframes pptx-vue-autosave-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
