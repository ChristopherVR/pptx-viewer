<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

/**
 * SignatureStrippedDialog: warns that editing a digitally-signed presentation
 * invalidates and strips its signatures on save. Vue port of the React
 * `SignatureStrippedDialog.tsx`. `confirm` proceeds with the edit; `cancel`
 * dismisses.
 */
const props = defineProps<{
	open: boolean;
	signatureCount: number;
}>();

const emit = defineEmits<{
	confirm: [];
	cancel: [];
}>();

const { t } = useI18n();
</script>

<template>
	<ModalDialog
		:open="props.open"
		:title="t('pptx.digitalSignatures.strippedTitle')"
		@close="emit('cancel')"
	>
		<div
			class="flex items-start gap-3 rounded-lg border border-amber-700/30 bg-amber-900/20 px-4 py-3"
		>
			<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
			<div class="space-y-2">
				<p class="text-xs text-amber-200">
					{{ t('pptx.digitalSignatures.strippedMessage', { count: props.signatureCount }) }}
				</p>
				<p class="text-[11px] text-amber-300/70">
					{{ t('pptx.digitalSignatures.strippedIrreversible') }}
				</p>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="rounded-lg bg-accent px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/80"
				@click="emit('cancel')"
			>
				{{ t('pptx.common.cancel') }}
			</button>
			<button
				type="button"
				class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-amber-500"
				@click="emit('confirm')"
			>
				{{ t('pptx.digitalSignatures.strippedConfirm') }}
			</button>
		</template>
	</ModalDialog>
</template>
