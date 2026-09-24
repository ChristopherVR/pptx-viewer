<script setup lang="ts">
/**
 * PasteSpecialDialog: Ctrl/Cmd+Alt+V. Offers the four Paste Special formats
 * PowerPoint's own dialog offers (Keep Source Formatting, Use Destination
 * Theme, Picture, Keep Text Only), sourced from `pptx-viewer-shared` so the
 * option set and its labels cannot drift from the post-paste "Paste Options"
 * toolbar or the other four bindings. Vue port of the React
 * `PasteSpecialDialog.tsx`.
 */
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import { PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

const { t } = useI18n();

const props = defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	cancel: [];
	confirm: [format: PasteSpecialFormat];
}>();

const selected = ref<PasteSpecialFormat>('keep-source-formatting');

watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			selected.value = 'keep-source-formatting';
		}
	},
);
</script>

<template>
	<ModalDialog
		:open="props.open"
		:title="t('pptx.pasteSpecial.dialogTitle')"
		marker-attr="data-pptx-paste-special-dialog"
		@close="emit('cancel')"
	>
		<ul class="flex flex-col gap-1">
			<li v-for="option in PASTE_SPECIAL_OPTIONS" :key="option.id">
				<label
					class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent cursor-pointer"
				>
					<input type="radio" name="paste-special-format" :value="option.id" v-model="selected" />
					{{ t(option.labelKey) }}
				</label>
			</li>
		</ul>

		<template #footer>
			<button
				type="button"
				class="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				@click="emit('cancel')"
			>
				{{ t('pptx.common.cancel') }}
			</button>
			<button
				type="button"
				class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
				@click="emit('confirm', selected)"
			>
				{{ t('pptx.common.ok') }}
			</button>
		</template>
	</ModalDialog>
</template>
