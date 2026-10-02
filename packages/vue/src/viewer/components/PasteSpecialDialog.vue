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

import DialogFooter from './DialogFooter.vue';
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
					<pptx-ui-radio
						name="paste-special-format"
						:value="option.id"
						:checked="selected === option.id"
						@change="selected = option.id"
					/>
					{{ t(option.labelKey) }}
				</label>
			</li>
		</ul>

		<template #footer>
			<DialogFooter
				:actions="[
					{ id: 'cancel', label: t('pptx.common.cancel') },
					{ id: 'ok', label: t('pptx.common.ok'), variant: 'primary' },
				]"
				@action="(id) => (id === 'ok' ? emit('confirm', selected) : emit('cancel'))"
			/>
		</template>
	</ModalDialog>
</template>
