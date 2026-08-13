<script setup lang="ts">
import { History, Trash2 } from 'lucide-vue-next';
import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

/**
 * AutosaveRecoveryDialog: "we found unsaved changes for this deck, want them?"
 *
 * Pure presentation over the shared `AutosaveRecoveryPrompt` descriptor, so all
 * five bindings offer the same recovery with the same words. Every string is a
 * key chosen by `pptx-viewer-shared`; this component picks none of them.
 */
const props = defineProps<{ prompt: AutosaveRecoveryPrompt | null }>();

const emit = defineEmits<{
	restore: [];
	discard: [];
}>();

const { t } = useI18n();

const title = computed(() => (props.prompt ? t(props.prompt.titleKey) : ''));
const message = computed(() =>
	props.prompt ? t(props.prompt.messageKey, props.prompt.messageParams) : '',
);
const savedLabel = computed(() =>
	props.prompt
		? t('pptx.autosave.recovery.savedLabel', {
				when: t(props.prompt.ageKey, props.prompt.ageParams),
			})
		: '',
);
</script>

<template>
	<ModalDialog
		v-if="props.prompt"
		:open="true"
		:title="title"
		marker-attr="data-pptx-autosave-recovery"
		@close="emit('discard')"
	>
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
				<History class="h-5 w-5 text-primary" />
			</div>
			<div>
				<p class="text-sm text-muted-foreground">{{ message }}</p>
				<p class="mt-2 text-xs text-muted-foreground">{{ savedLabel }}</p>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				@click="emit('discard')"
			>
				<Trash2 class="h-4 w-4" />
				{{ t(props.prompt.discardKey) }}
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
				@click="emit('restore')"
			>
				<History class="h-4 w-4" />
				{{ t(props.prompt.restoreKey) }}
			</button>
		</template>
	</ModalDialog>
</template>
