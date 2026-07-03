<script setup lang="ts">
/**
 * AutosaveIndicator: a tiny status pill for the editor toolbar.
 *
 * Reflects the autosave lifecycle (`status`) and the unsaved-edits flag
 * (`isDirty`) as a short label: "Saving…", "Saved", "Save failed", or
 * "Unsaved changes". Purely presentational; the logic lives in
 * `useAutosave`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AutosaveStatus } from '../composables/useAutosave';

const props = defineProps<{
	status: AutosaveStatus;
	isDirty: boolean;
}>();

const { t } = useI18n();

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
			return t('pptx.autosave.saving');
		case 'error':
			return t('pptx.autosave.error');
		case 'dirty':
			return t('pptx.statusBar.unsavedChanges');
		case 'saved':
			return t('pptx.autosave.savedShort');
		default:
			return t('pptx.statusBar.allSaved');
	}
});

/** Per-tone text colour, mirroring React's status colours. */
const toneColor = computed(() => {
	switch (tone.value) {
		case 'saving':
			return 'text-yellow-400';
		case 'error':
			return 'text-red-400';
		case 'dirty':
			return 'text-amber-500';
		case 'saved':
			return 'text-green-500';
		default:
			return 'text-muted-foreground';
	}
});
</script>

<template>
	<span
		class="pptx-vue-autosave inline-flex items-center gap-[0.4em] rounded-full px-[0.6em] py-[0.15em] text-xs leading-[1.4] whitespace-nowrap select-none bg-muted"
		:class="[`pptx-vue-autosave--${tone}`, toneColor]"
		role="status"
		aria-live="polite"
	>
		<span
			v-if="tone === 'saving'"
			class="pptx-vue-autosave__spinner w-[0.7em] h-[0.7em] rounded-full border-2 border-current border-t-transparent opacity-85 animate-spin"
			aria-hidden="true"
		/>
		<span
			v-else
			class="pptx-vue-autosave__dot w-[0.5em] h-[0.5em] rounded-full bg-current opacity-70"
			aria-hidden="true"
		/>
		{{ label }}
	</span>
</template>
