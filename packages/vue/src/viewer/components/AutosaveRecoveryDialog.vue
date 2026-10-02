<script setup lang="ts">
import { History } from 'lucide-vue-next';
import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import DialogFooter from './DialogFooter.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * AutosaveRecoveryDialog: "we found unsaved changes for this deck, want them?"
 *
 * Pure presentation over the shared `AutosaveRecoveryPrompt` descriptor, so all
 * five bindings offer the same recovery with the same words. Every string is a
 * key chosen by `pptx-viewer-shared`; this component picks none of them.
 */
const props = withDefaults(
	defineProps<{ prompt: AutosaveRecoveryPrompt | null; discarding?: boolean }>(),
	{ discarding: false },
);

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

function requestDiscard(): void {
	if (!props.discarding) {
		emit('discard');
	}
}
</script>

<template>
	<ModalDialog
		v-if="props.prompt"
		:open="true"
		:title="title"
		marker-attr="data-pptx-autosave-recovery"
		:busy="props.discarding"
		:close-disabled="props.discarding"
		@close="requestDiscard"
	>
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
				<History class="h-5 w-5 text-primary" />
			</div>
			<div class="min-w-0">
				<p class="text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ message }}</p>
				<p class="mt-2 text-xs text-muted-foreground">{{ savedLabel }}</p>
			</div>
		</div>

		<template #footer>
			<DialogFooter
				:actions="[
					{
						id: 'discard',
						label: t(props.prompt.discardKey),
						icon: 'trash',
						disabled: props.discarding,
					},
					{
						id: 'restore',
						label: t(props.prompt.restoreKey),
						variant: 'primary',
						icon: 'restore',
						disabled: props.discarding,
					},
				]"
				@action="(id) => (id === 'restore' ? emit('restore') : requestDiscard())"
			/>
		</template>
	</ModalDialog>
</template>
