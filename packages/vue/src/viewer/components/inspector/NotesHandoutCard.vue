<script setup lang="ts">
/**
 * NotesHandoutCard: read-only NOTES & HANDOUT card (Notes Size / Notes Master /
 * Handout Master rows), mirroring React's `NotesHandoutCard` in
 * `inspector/DocumentPropertiesCards.tsx`.
 */
import type { PptxHandoutMaster, PptxNotesMaster } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../../types';
import { CARD, HEADING } from './inspector-cards';

const props = defineProps<{
	notesCanvasSize?: CanvasSize;
	notesMaster?: PptxNotesMaster;
	handoutMaster?: PptxHandoutMaster;
}>();

const { t } = useI18n();

const rows = computed<Array<{ label: string; value: string }>>(() => [
	{
		label: t('pptx.documentProperties.notesSize'),
		value: props.notesCanvasSize
			? `${props.notesCanvasSize.width} × ${props.notesCanvasSize.height}px`
			: t('pptx.digitalSignatures.notAvailable'),
	},
	{
		label: t('pptx.master.notesMasterTitle'),
		value: props.notesMaster
			? `${props.notesMaster.placeholders?.length ?? 0} placeholders`
			: t('pptx.digitalSignatures.notAvailable'),
	},
	{
		label: t('pptx.master.handoutMasterTitle'),
		value: props.handoutMaster
			? `${props.handoutMaster.placeholders?.length ?? 0} placeholders`
			: t('pptx.digitalSignatures.notAvailable'),
	},
]);
</script>

<template>
	<div :class="CARD">
		<div :class="HEADING">{{ t('pptx.documentProperties.notesHandoutHeading') }}</div>
		<div class="space-y-1 text-[11px] text-muted-foreground">
			<div v-for="row in rows" :key="row.label" class="flex items-center justify-between gap-2">
				<span>{{ row.label }}</span>
				<span class="text-muted-foreground">{{ row.value }}</span>
			</div>
		</div>
	</div>
</template>
